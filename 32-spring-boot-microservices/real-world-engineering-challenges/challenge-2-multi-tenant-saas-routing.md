# Challenge 2: Dynamic Multi-Tenant SaaS Routing

## Architecture Diagram

```text
[ HTTP Request (Header: X-Tenant-ID: customerA) ]
          |
[ TenantFilter (Extracts Header, saves to ThreadLocal) ]
          |
[ Controller / Service / Repository ]
          |
[ Hibernate MultiTenancyConnectionProvider ]
          |-- Reads ThreadLocal "customerA"
          |-- Connects to Master Database
          |-- Executes: "SET SCHEMA 'customerA';"
          |
[ Execute SQL Query in customerA's isolated schema ]
```

## Starter Template

```java
import org.springframework.stereotype.Component;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;

// 1. ThreadLocal Context to hold the Tenant ID for the current thread
public class TenantContext {
    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();
    public static void setTenantId(String tenantId) { CURRENT_TENANT.set(tenantId); }
    public static String getTenantId() { return CURRENT_TENANT.get(); }
    public static void clear() { CURRENT_TENANT.remove(); }
}

// 2. Filter to intercept the HTTP header
@Component
public class TenantFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        // TODO: Extract X-Tenant-ID header
        // TODO: Set it in TenantContext
        // TODO: Continue chain
        // TODO: Clear Context in finally block
    }
}
```

## Production Solution Walkthrough

```java
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.hibernate.engine.jdbc.connections.spi.MultiTenantConnectionProvider;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

// 1. Tell Hibernate which Tenant is currently active
@Component
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver {

    @Override
    public String resolveCurrentTenantIdentifier() {
        String tenantId = TenantContext.getTenantId();
        // Fallback to a default schema (e.g., 'public') if no tenant is provided
        return tenantId != null ? tenantId : "public";
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return true; // Ensure Hibernate checks the tenant ID before reusing existing sessions
    }
}

// 2. Tell Hibernate HOW to connect to that tenant's data
@Component
public class SchemaMultiTenantConnectionProvider implements MultiTenantConnectionProvider {

    private final DataSource dataSource;

    public SchemaMultiTenantConnectionProvider(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public Connection getAnyConnection() throws SQLException {
        return dataSource.getConnection();
    }

    @Override
    public void releaseAnyConnection(Connection connection) throws SQLException {
        connection.close();
    }

    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
        Connection connection = getAnyConnection();
        // Here is the magic: We execute a SQL command to switch the schema on the fly
        // Note: Syntax varies by DB. This is PostgreSQL syntax.
        connection.createStatement().execute("SET SCHEMA '" + tenantIdentifier + "'");
        return connection;
    }

    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection) throws SQLException {
        // Reset to default schema before returning the connection to the pool!
        connection.createStatement().execute("SET SCHEMA 'public'");
        releaseAnyConnection(connection);
    }

    @Override
    public boolean supportsAggressiveRelease() {
        return false;
    }

    @Override
    public boolean isUnwrappableAs(Class unwrapType) { return false; }

    @Override
    public <T> T unwrap(Class<T> unwrapType) { return null; }
}

// 3. Register our custom providers with Spring Boot's Hibernate configuration
@Configuration
public class HibernateConfig {

    @Bean
    public HibernatePropertiesCustomizer hibernatePropertiesCustomizer(
            MultiTenantConnectionProvider multiTenantConnectionProvider,
            CurrentTenantIdentifierResolver currentTenantIdentifierResolver) {

        return properties -> {
            properties.put(AvailableSettings.MULTI_TENANT_CONNECTION_PROVIDER, multiTenantConnectionProvider);
            properties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, currentTenantIdentifierResolver);
        };
    }
}
```

## Test Suite

```java
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
class MultiTenancyIntegrationTest {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setupSchemas() {
        // Create two separate schemas and tables for testing
        jdbcTemplate.execute("CREATE SCHEMA IF NOT EXISTS tenant_a;");
        jdbcTemplate.execute("CREATE SCHEMA IF NOT EXISTS tenant_b;");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS tenant_a.employee (id INT PRIMARY KEY, name VARCHAR(255));");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS tenant_b.employee (id INT PRIMARY KEY, name VARCHAR(255));");

        jdbcTemplate.execute("INSERT INTO tenant_a.employee VALUES (1, 'Alice');");
        jdbcTemplate.execute("INSERT INTO tenant_b.employee VALUES (1, 'Bob');");
    }

    @AfterEach
    void cleanup() {
        TenantContext.clear();
        jdbcTemplate.execute("DROP SCHEMA tenant_a CASCADE;");
        jdbcTemplate.execute("DROP SCHEMA tenant_b CASCADE;");
    }

    @Test
    void testDataIsolationBetweenTenants() {
        // 1. Pretend a request comes in for Tenant A
        TenantContext.setTenantId("tenant_a");

        // When we call findAll, Hibernate intercepts it, reads "tenant_a" from the context,
        // gets a connection, runs "SET SCHEMA 'tenant_a'", and then runs the SELECT query.
        Employee employeeA = employeeRepository.findById(1L).orElseThrow();
        assertEquals("Alice", employeeA.getName());

        // 2. Pretend a request comes in for Tenant B
        TenantContext.setTenantId("tenant_b");

        Employee employeeB = employeeRepository.findById(1L).orElseThrow();
        assertEquals("Bob", employeeB.getName()); // It automatically routed to the other schema!
    }
}
```