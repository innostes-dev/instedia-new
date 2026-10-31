# Challenge 5: Zero-Trust OAuth2 Gateway with mTLS

## Architecture Diagram

```text
[ Client Application (React/Mobile) ]
          |
    (TLS 1.3 / HTTPS)
          |
[ Load Balancer / Nginx ] ---> (Terminates external TLS)
          |
    (mTLS / Mutual TLS) ---> Internal network communication is strictly encrypted and verified
          |
[ Spring Cloud Gateway ] (The Entrypoint)
          |
          |-- 1. Token Relay Filter (Extracts Bearer Token)
          |-- 2. OAuth2 Introspection (Validates token against Auth Server)
          |-- 3. RateLimiter (Redis-backed request limits)
          |
    (mTLS)
          v
[ Internal Microservices (Order, Inventory) ]
```

## Starter Template

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity // Spring Cloud Gateway uses WebFlux (Reactive), not MVC!
public class GatewaySecurityConfig {

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        // TODO: Disable CSRF
        // TODO: Configure route authorization
        // TODO: Enable OAuth2 Resource Server with Opaque Token Introspection

        return http.build();
    }
}
```

## Production Solution Walkthrough

```yaml
# application.yml
server:
  port: 8443
  ssl:
    # mTLS Configuration (Mutual TLS)
    # The gateway proves who it is to the client (standard TLS)
    key-store: classpath:gateway-keystore.p12
    key-store-password: password
    key-password: password
    # AND the gateway forces the internal microservices/clients to prove who they are
    trust-store: classpath:gateway-truststore.p12
    trust-store-password: password
    client-auth: need # 'need' enforces mTLS. 'want' makes it optional.

spring:
  cloud:
    gateway:
      routes:
        - id: order_service
          uri: https://order-service:8081 # Must use HTTPS internally
          predicates:
            - Path=/api/orders/**
          filters:
            # Passes the OAuth2 token down to the microservice
            - TokenRelay=
            # Redis Rate Limiting (Requires spring-boot-starter-data-redis-reactive)
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 10
                redis-rate-limiter.burstCapacity: 20
  security:
    oauth2:
      resourceserver:
        opaquetoken:
          # Unlike JWTs which are self-contained, Opaque tokens require the gateway
          # to call the Auth Server to check if they are valid/revoked.
          introspection-uri: https://auth-server:9000/oauth2/introspect
          client-id: gateway-client
          client-secret: secret
```

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
public class GatewaySecurityConfig {

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        http
            // Disable CSRF for stateless APIs
            .csrf(csrf -> csrf.disable())

            // Require authentication for all routes passing through the gateway
            .authorizeExchange(exchanges -> exchanges
                .pathMatchers("/api/public/**").permitAll()
                .anyExchange().authenticated()
            )

            // Configure as an OAuth2 Resource Server
            // It looks for the `spring.security.oauth2.resourceserver.opaquetoken` config in YAML
            .oauth2ResourceServer(oauth2 -> oauth2
                .opaqueToken()
            );

        return http.build();
    }
}
```

## Test Suite

```java
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
class GatewaySecurityConfigTest {

    @Autowired
    private WebTestClient webClient;

    @Test
    void whenUnauthenticated_thenRejectWith401() {
        // Attempting to access a protected route without a token
        webClient.get().uri("/api/orders/1")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void whenPublicRoute_thenAllowUnauthenticated() {
        // Attempting to access a public route
        webClient.get().uri("/api/public/status")
                .exchange()
                // Assuming the downstream service isn't running in this test,
                // the Gateway will return a 404 or 503, but NOT a 401 Unauthorized.
                .expectStatus().is5xxServerError();
    }
}
```