# Challenge 1: High-Concurrency Idempotent Payment Settlement Gateway

## Architecture Diagram

```text
[ Client (React/Mobile) ]
          |
    POST /api/payments
    { "idempotencyKey": "uuid-1234", "orderId": 99, "amount": 100.00 }
          |
          v
[ Spring Boot Payment Service ]
          |
          |-- 1. Check Redis for Lock (Key: "lock:payment:uuid-1234")
          |       |-- If exists -> Return 409 Conflict (Already Processing)
          |       |-- If not exists -> Acquire Lock (SETNX)
          |
          |-- 2. Check Database for Existing Payment
          |       |-- If exists (Status: SUCCESS) -> Return HTTP 200 (Existing Payment)
          |       |-- If exists (Status: FAILED) -> Proceed to retry
          |
          |-- 3. Execute 3rd Party Payment (Stripe/PayPal)
          |       |-- Update Database (Status: SUCCESS / FAILED)
          |
          |-- 4. Release Redis Lock (DEL "lock:payment:uuid-1234")
          |
          v
[ Client receives HTTP 200 ]
```

## Starter Template

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    // TODO: Inject your services

    @PostMapping
    public ResponseEntity<String> processPayment(
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody PaymentRequest request) {

        // TODO: Implement Distributed Locking via Redis
        // TODO: Implement Idempotency Check in DB
        // TODO: Process Payment

        return ResponseEntity.ok("Payment Processed");
    }
}

class PaymentRequest {
    private Long orderId;
    private Double amount;
    // Getters and Setters
}
```

## Production Solution Walkthrough

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

@Service
public class PaymentService {

    private final StringRedisTemplate redisTemplate;
    private final PaymentRepository paymentRepository;
    private final StripeGateway stripeGateway;

    public PaymentService(StringRedisTemplate redisTemplate,
                          PaymentRepository paymentRepository,
                          StripeGateway stripeGateway) {
        this.redisTemplate = redisTemplate;
        this.paymentRepository = paymentRepository;
        this.stripeGateway = stripeGateway;
    }

    public Payment processPayment(String idempotencyKey, Long orderId, Double amount) {
        String lockKey = "lock:payment:" + idempotencyKey;

        // 1. Acquire Distributed Lock (SETNX)
        // If the key already exists, setIfAbsent returns false.
        // We set a 30-second TTL to prevent deadlocks if the server crashes while holding the lock.
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(lockKey, "LOCKED", Duration.ofSeconds(30));

        if (Boolean.FALSE.equals(acquired)) {
            throw new ConcurrentPaymentException("Payment is currently being processed. Please wait.");
        }

        try {
            // 2. Idempotency Check (Database)
            // If the payment was already successful in a previous request, just return it.
            return paymentRepository.findByIdempotencyKey(idempotencyKey)
                    .map(existing -> {
                        if (existing.getStatus() == PaymentStatus.SUCCESS) {
                            return existing;
                        }
                        // If it failed previously, we can try again
                        return executePayment(existing, amount);
                    })
                    .orElseGet(() -> {
                        // First time seeing this payment
                        Payment newPayment = new Payment(idempotencyKey, orderId);
                        return executePayment(newPayment, amount);
                    });

        } finally {
            // 3. Always release the lock, even if an exception occurs
            redisTemplate.delete(lockKey);
        }
    }

    // Must be transactional to ensure DB saves correctly
    @Transactional
    protected Payment executePayment(Payment payment, Double amount) {
        try {
            // Call external provider
            String transactionId = stripeGateway.charge(amount);
            payment.setTransactionId(transactionId);
            payment.setStatus(PaymentStatus.SUCCESS);
        } catch (Exception e) {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setErrorMessage(e.getMessage());
        }
        return paymentRepository.save(payment);
    }
}
```

## Test Suite (JUnit 5 & Testcontainers)

```java
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.*;

@SpringBootTest
@Testcontainers
class PaymentServiceTest {

    // Spin up a real Redis container for tests
    @Container
    public static GenericContainer redis = new GenericContainer("redis:7.0-alpine")
            .withExposedPorts(6379);

    @Autowired
    private PaymentService paymentService;

    @MockBean
    private StripeGateway stripeGateway;

    @Test
    void testIdempotencyUnderConcurrency() throws InterruptedException {
        String idempotencyKey = "uuid-concurrency-test";
        when(stripeGateway.charge(anyDouble())).thenReturn("txn_123");

        int threads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(1);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    latch.await(); // Wait for all threads to be ready
                    paymentService.processPayment(idempotencyKey, 99L, 50.0);
                    successCount.incrementAndGet();
                } catch (ConcurrentPaymentException e) {
                    conflictCount.incrementAndGet();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        // Release the hounds! All 10 threads hit the method at the exact same millisecond.
        latch.countDown();
        Thread.sleep(2000); // Wait for processing

        // Verify that exactly ONE thread acquired the lock and executed the payment.
        // The other 9 should have been rejected or returned the cached idempotent result.
        verify(stripeGateway, times(1)).charge(50.0);

        // 1 success (the one that got the lock), 9 conflicts (rejected by Redis SETNX)
        assertEquals(1, successCount.get());
        assertEquals(9, conflictCount.get());
    }
}
```