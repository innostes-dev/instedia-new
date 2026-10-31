# Challenge 4: APM Java Agent (Dynamic Bytecode Instrumentation)

## Architecture Overview
In enterprise systems, you often need to monitor the performance of your application (e.g., "How long does `OrderService.process()` take?"). Historically, developers would hardcode `long start = System.currentTimeMillis();` at the top of every method. This litters the codebase with boilerplate.

Modern Application Performance Monitoring (APM) tools like New Relic, Datadog, or AppDynamics don't ask you to change your code. Instead, they provide a **Java Agent**.

A Java Agent attaches to the JVM at startup (via the `-javaagent` flag) and intercepts classes *as they are being loaded into memory*. Using a library like **ByteBuddy** or **ASM**, the Agent manipulates the raw bytecode, injecting timing logic directly into the compiled `.class` files dynamically.

## The Challenge
Build a custom APM Java Agent using ByteBuddy. It must intercept any method in any class annotated with `@ProfileExecutionTime`. It should dynamically inject bytecode that starts a timer before the method runs, and prints the total execution time after the method finishes.

### Requirements
1. **The Annotation:** Create a simple `@ProfileExecutionTime` annotation.
2. **The Interceptor:** Write a static method (the Interceptor) that captures the start time, calls the original method (via `Callable<?>`), measures the end time, and prints it.
3. **The Agent Premain:** Implement the standard `premain(String agentArgs, Instrumentation inst)` method required by all Java Agents.
4. **ByteBuddy Transformation:** Use `AgentBuilder` to tell ByteBuddy to find all methods annotated with `@ProfileExecutionTime` and delegate them to your Interceptor.

---

## Starter Template

```java
import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.description.type.TypeDescription;
import net.bytebuddy.dynamic.DynamicType;
import net.bytebuddy.implementation.MethodDelegation;
import net.bytebuddy.implementation.bind.annotation.Origin;
import net.bytebuddy.implementation.bind.annotation.RuntimeType;
import net.bytebuddy.implementation.bind.annotation.SuperCall;
import net.bytebuddy.matcher.ElementMatchers;
import net.bytebuddy.utility.JavaModule;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.instrument.Instrumentation;
import java.lang.reflect.Method;
import java.security.ProtectionDomain;
import java.util.concurrent.Callable;

public class CustomApmAgent {

    // 1. The custom annotation
    @Retention(RetentionPolicy.RUNTIME)
    public @interface ProfileExecutionTime {}

    // 2. The Interceptor logic
    public static class TimingInterceptor {
        @RuntimeType
        public static Object intercept(@Origin Method method, @SuperCall Callable<?> callable) throws Exception {
            // TODO: Record start time
            try {
                // TODO: Call the original method (callable.call())
                return null;
            } finally {
                // TODO: Record end time
                // TODO: Print "Method [name] executed in [X]ms"
            }
        }
    }

    // 3. The Agent Entry Point (Called by the JVM before main())
    public static void premain(String agentArgs, Instrumentation inst) {
        System.out.println("[Custom APM] Agent attached. Scanning for @ProfileExecutionTime...");

        // 4. ByteBuddy instrumentation
        new AgentBuilder.Default()
            // TODO: Create a rule to match any class
            // TODO: Transform the class by intercepting methods that have the annotation
            // TODO: Delegate those matched methods to TimingInterceptor.class
            .installOn(inst);
    }
}
```

---

## Boss Level Solution Walkthrough

<details>
<summary><b>Click to reveal the production-grade implementation</b></summary>

### 1. The Agent Implementation (`CustomApmAgent.java`)
*Note: This requires adding the `net.bytebuddy:byte-buddy` dependency.*

```java
import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.implementation.MethodDelegation;
import net.bytebuddy.implementation.bind.annotation.Origin;
import net.bytebuddy.implementation.bind.annotation.RuntimeType;
import net.bytebuddy.implementation.bind.annotation.SuperCall;
import net.bytebuddy.matcher.ElementMatchers;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.instrument.Instrumentation;
import java.lang.reflect.Method;
import java.util.concurrent.Callable;

public class CustomApmAgent {

    // The Annotation used to mark methods for profiling
    @Retention(RetentionPolicy.RUNTIME)
    public @interface ProfileExecutionTime {}

    // The Interceptor class containing the injected logic
    public static class TimingInterceptor {

        // @RuntimeType allows this to wrap methods returning any type (void, String, etc.)
        // @Origin provides reflection metadata about the intercepted method
        // @SuperCall provides a hook to invoke the original, unmodified method body
        @RuntimeType
        public static Object intercept(@Origin Method method, @SuperCall Callable<?> originalMethod) throws Exception {
            long start = System.nanoTime();
            try {
                // Execute the original method
                return originalMethod.call();
            } finally {
                long end = System.nanoTime();
                long durationMs = (end - start) / 1_000_000;
                System.out.println("[APM] Execution of " + method.getDeclaringClass().getSimpleName()
                                   + "." + method.getName() + " took " + durationMs + "ms");
            }
        }
    }

    // The JVM invokes this method before calling the application's main() method
    public static void premain(String agentArgs, Instrumentation inst) {
        System.out.println("[Custom APM Agent] Initializing Bytecode Transformer...");

        new AgentBuilder.Default()
            // Step 1: Match ANY class being loaded (you can restrict this to specific packages for performance)
            .type(ElementMatchers.any())

            // Step 2: Define the transformation rule
            .transform((builder, typeDescription, classLoader, module, protectionDomain) ->
                builder.method(ElementMatchers.isAnnotatedWith(ProfileExecutionTime.class)) // Match annotated methods
                       .intercept(MethodDelegation.to(TimingInterceptor.class))             // Inject our logic
            )
            // Register it with the JVM's Instrumentation engine
            .installOn(inst);
    }
}
```

### 2. The Target Application (`App.java`)

```java
public class App {

    // The developer just adds an annotation. No boilerplate timing code!
    @CustomApmAgent.ProfileExecutionTime
    public void processPayment() throws InterruptedException {
        System.out.println("Processing payment...");
        Thread.sleep(1200); // Simulate slow DB call
        System.out.println("Payment successful.");
    }

    public void unprofiledMethod() {
        System.out.println("Doing something fast...");
    }

    public static void main(String[] args) throws InterruptedException {
        App app = new App();
        app.unprofiledMethod();
        app.processPayment();
    }
}
```

### 3. Running the Agent (The Production Setup)
To run a Java Agent, you must package it as a JAR file with a specific `MANIFEST.MF` entry.

**Manifest File (`MANIFEST.MF`):**
```text
Manifest-Version: 1.0
Premain-Class: CustomApmAgent
Can-Redefine-Classes: true
Can-Retransform-Classes: true
```

**Execution Command:**
When starting the target application, attach the agent using the `-javaagent` JVM argument:
```bash
java -javaagent:custom-apm-agent.jar -cp target-app.jar App
```

**Expected Output:**
```text
[Custom APM Agent] Initializing Bytecode Transformer...
Doing something fast...
Processing payment...
Payment successful.
[APM] Execution of App.processPayment took 1205ms
```

### Why this is Production-Grade
1. **Zero Source Code Modification:** The target application doesn't need to know how the timing works. It just uses annotations. This achieves perfect Separation of Concerns.
2. **ByteBuddy Generation:** Unlike older libraries like ASM which require you to manually write raw JVM OpCodes (which is error-prone), ByteBuddy allows you to write the interceptor in standard Java. ByteBuddy handles translating `intercept()` into valid JVM bytecode dynamically.
3. **`@SuperCall` Delegation:** By injecting a `Callable`, the agent cleanly wraps the original method, ensuring that if the original method throws an exception, the APM tool still records the end time in the `finally` block before re-throwing the error up the stack.

</details>
