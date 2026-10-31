# Challenge 4: CDC & Transactional Outbox Pipeline

## Architecture Diagram

```text
[ Spring Boot Order Service ]
       |
       |-- @Transactional
       |-- 1. INSERT INTO orders (id, amount, status)
       |-- 2. INSERT INTO outbox_events (id, aggregate_id, payload, event_type)
       |-- COMMIT (Both succeed, or both fail)

[ Database (PostgreSQL/MySQL) ]
       |
       |-- Transaction Log (WAL / Binlog)
       v
[ Debezium Connector ] (Listens to DB Transaction Log)
       |
       |-- Detects INSERT on `outbox_events` table
       |-- Extracts `payload`
       v
[ Apache Kafka ] (Topic: order-events)
       |
       v
[ Spring Boot Inventory Service ] (Kafka Listener)
```

## Starter Template

```java
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 1. Entities
@Entity
class Order {
    @Id private Long id;
    private Double total;
    // Getters/Setters
}

@Entity
class OutboxEvent {
    @Id private String eventId;
    private String aggregateId;
    private String eventType;
    private String payload;
    // Getters/Setters
}

// 2. Service
@Service
public class OrderCheckoutService {

    // TODO: Inject Repositories & ObjectMapper

    @Transactional
    public void checkout(Order order) {
        // TODO: Save the Order to the database
        // TODO: Serialize the Order to JSON
        // TODO: Create an OutboxEvent and save it to the database in the SAME transaction
    }
}
```

## Production Solution Walkthrough

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class OrderCheckoutService {

    private final OrderRepository orderRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public OrderCheckoutService(OrderRepository orderRepository,
                                OutboxEventRepository outboxEventRepository,
                                ObjectMapper objectMapper) {
        this.orderRepository = orderRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
    }

    // THE OUTBOX PATTERN: Dual-Write problem solved.
    // If the DB crashes right after saving the order, the outbox event is also rolled back.
    // We never rely on a network call (like kafkaTemplate.send) inside a DB transaction!
    @Transactional
    public void checkout(Order order) {

        // 1. Save business data
        order.setStatus(OrderStatus.PENDING);
        orderRepository.save(order);

        try {
            // 2. Serialize event payload
            OrderCreatedPayload payload = new OrderCreatedPayload(order.getId(), order.getTotal());
            String jsonPayload = objectMapper.writeValueAsString(payload);

            // 3. Save event to Outbox table
            OutboxEvent event = new OutboxEvent();
            event.setEventId(UUID.randomUUID().toString());
            event.setAggregateType("Order");
            event.setAggregateId(String.valueOf(order.getId()));
            event.setEventType("OrderCreated");
            event.setPayload(jsonPayload);

            outboxEventRepository.save(event);

        } catch (Exception e) {
            // Because we re-throw a RuntimeException, Spring's @Transactional will ROLLBACK
            // the orderRepository.save() that happened in step 1.
            throw new RuntimeException("Failed to create outbox event", e);
        }
    }
}
```

## Test Suite

```java
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
class OrderCheckoutServiceTest {

    @Autowired
    private OrderCheckoutService checkoutService;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Test
    void testTransactionalOutboxSuccess() {
        Order order = new Order();
        order.setId(100L);
        order.setTotal(59.99);

        checkoutService.checkout(order);

        // Verify Order is saved
        Order savedOrder = orderRepository.findById(100L).orElseThrow();
        assertEquals(59.99, savedOrder.getTotal());

        // Verify Outbox Event is saved
        List<OutboxEvent> events = outboxEventRepository.findAll();
        assertEquals(1, events.size());

        OutboxEvent event = events.get(0);
        assertEquals("Order", event.getAggregateType());
        assertEquals("100", event.getAggregateId());
        assertEquals("OrderCreated", event.getEventType());
    }
}
```