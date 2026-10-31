# Challenge 3: Self-Healing Microservice Resiliency Pipeline

## Architecture Diagram

```text
[ Core Service ]
       |
       |-- Call External API (GET /customer-score)
       |
[ Resilience4j Bulkhead ] (Max 20 concurrent threads allowed)
       |
[ Resilience4j TimeLimiter ] (Timeout if > 3 seconds)
       |
[ Resilience4j CircuitBreaker ] (Trips if > 50% calls fail in last 10 calls)
       |
       |-- [ CLOSED / HALF-OPEN ] --> Executes API Call
       |
       |-- [ OPEN / TIMEOUT / THREAD LIMIT ] --> Throws Exception
                                                   |
                                                   v
[ Fallback Method (Graceful Degradation) ]
       |
       |-- 1. Returns Default Score (e.g., 500)
       |-- 2. Publishes "FallbackTriggeredEvent" to RabbitMQ
       |
       v
[ RabbitMQ / Dead Letter Queue ] ---> Async Retry Worker picks up event later
```

## Starter Template

```java
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.springframework.stereotype.Service;
import java.util.concurrent.CompletableFuture;

@Service
public class CreditScoreService {

    // TODO: Add Bulkhead Annotation
    // TODO: Add TimeLimiter Annotation
    // TODO: Add CircuitBreaker Annotation
    public CompletableFuture<Integer> fetchScore(String customerId) {

        return CompletableFuture.supplyAsync(() -> {
            // Simulate network call
            return 750;
        });
    }

    // TODO: Implement fallback method with same signature
    // public CompletableFuture<Integer> fetchScoreFallback(String customerId, Throwable t) { ... }
}
```

## Production Solution Walkthrough

```yaml
# application.yml
resilience4j:
  circuitbreaker:
    instances:
      creditApi:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 15s
        permittedNumberOfCallsInHalfOpenState: 3
  timelimiter:
    instances:
      creditApi:
        timeoutDuration: 3s
  bulkhead:
    instances:
      creditApi:
        maxConcurrentCalls: 20
```

```java
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.concurrent.CompletableFuture;

@Service
public class CreditScoreService {

    private static final Logger log = LoggerFactory.getLogger(CreditScoreService.class);
    private final RestTemplate restTemplate;
    private final MessageQueuePublisher mqPublisher;

    public CreditScoreService(RestTemplate restTemplate, MessageQueuePublisher mqPublisher) {
        this.restTemplate = restTemplate;
        this.mqPublisher = mqPublisher;
    }

    // Order of operations: Bulkhead -> TimeLimiter -> CircuitBreaker
    @Bulkhead(name = "creditApi", type = Bulkhead.Type.SEMAPHORE)
    @TimeLimiter(name = "creditApi")
    @CircuitBreaker(name = "creditApi", fallbackMethod = "fetchScoreFallback")
    public CompletableFuture<Integer> fetchScore(String customerId) {

        return CompletableFuture.supplyAsync(() -> {
            log.info("Attempting to fetch score for {}", customerId);
            // This could throw RestClientException (500 Server Error)
            // Or it could take 10 seconds (triggering TimeLimiter)
            Integer score = restTemplate.getForObject(
                "http://legacy-credit-bureau.com/api/score/" + customerId,
                Integer.class
            );
            return score != null ? score : 500;
        });
    }

    // Fallback executes if Bulkhead is full, TimeLimiter times out, Circuit is OPEN, or Network fails.
    public CompletableFuture<Integer> fetchScoreFallback(String customerId, Throwable t) {
        log.warn("Fallback triggered for customer {}. Reason: {}", customerId, t.getMessage());

        // Publish event so an async worker can try to update the score later
        mqPublisher.publishRetryEvent(new ScoreRetryEvent(customerId));

        // Return a safe default so the user journey continues
        return CompletableFuture.completedFuture(500);
    }
}
```

## Test Suite

```java
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.web.client.RestTemplate;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@SpringBootTest
class CreditScoreServiceTest {

    @Autowired
    private CreditScoreService creditScoreService;

    @MockBean
    private RestTemplate restTemplate;

    @MockBean
    private MessageQueuePublisher mqPublisher;

    @Test
    void testCircuitBreakerTripsAndFallsBack() throws Exception {
        // 1. Force the external API to fail with an exception
        when(restTemplate.getForObject(anyString(), eq(Integer.class)))
                .thenThrow(new RuntimeException("500 Internal Server Error"));

        // 2. Hammer the API 10 times to trip the Circuit Breaker
        // (slidingWindowSize is 10, failure rate is 50%, so 10 failures trips it)
        for (int i = 0; i < 10; i++) {
            CompletableFuture<Integer> future = creditScoreService.fetchScore("cust-123");

            // The future completes successfully because the fallback handles the error!
            Integer result = future.get();
            assertEquals(500, result); // Returns default score
        }

        // 3. Verify the actual network call was attempted 10 times
        verify(restTemplate, times(10)).getForObject(anyString(), eq(Integer.class));

        // 4. Verify fallback published events
        verify(mqPublisher, times(10)).publishRetryEvent(any());

        // 5. THE CRITICAL TEST: 11th call. Circuit is now OPEN.
        CompletableFuture<Integer> future11 = creditScoreService.fetchScore("cust-123");
        Integer result11 = future11.get();
        assertEquals(500, result11);

        // 6. Verify the network call was NOT attempted an 11th time
        // The proxy blocked it and immediately routed to the fallback.
        verify(restTemplate, times(10)).getForObject(anyString(), eq(Integer.class));
    }
}
```