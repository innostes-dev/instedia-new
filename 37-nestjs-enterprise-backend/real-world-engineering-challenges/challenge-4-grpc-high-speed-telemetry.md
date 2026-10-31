# Real-World Engineering Challenge: High-Performance gRPC Microservice Mesh

## 1. Context & Architecture
IoT devices (e.g., millions of smart meters) are sending thousands of telemetry payloads per second to your backend. A standard HTTP/JSON REST API will buckle under the CPU load of JSON parsing and the network overhead of HTTP headers.

You need to architect a **gRPC Microservice Mesh**.
- **Gateway Service:** Receives standard HTTP traffic (for dashboard visualization) but acts as a gRPC client to fetch data instantly.
- **Telemetry Service (gRPC):** A highly optimized backend service that only speaks Protobuf. It receives high-speed binary streams of telemetry data and responds in milliseconds.

### Architecture Diagram
```text
[IoT Device] ──(gRPC Stream)──► [Telemetry Service] (Saves to DB)

[Web Dashboard] ──(HTTP GET)──► [Gateway Service]
                                       │
                                   (gRPC Call: Fast, Binary, Typed)
                                       │
                                       ▼
                                [Telemetry Service]
```

---

## 2. Starter Template

```typescript
// npm i @nestjs/microservices @grpc/grpc-js @grpc/proto-loader

// ==========================================
// 1. Proto Definition (telemetry.proto)
// ==========================================
/*
syntax = "proto3";
package telemetry;

service TelemetryService {
  rpc GetDeviceStatus (DeviceId) returns (DeviceStatus) {}
}

message DeviceId {
  string id = 1;
}

message DeviceStatus {
  string id = 1;
  float temperature = 2;
  bool isOnline = 3;
}
*/

// ==========================================
// 2. Gateway Service (HTTP to gRPC)
// ==========================================
import { Controller, Get, Param, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';

// Interface representing the gRPC methods
interface TelemetryGrpcService {
  getDeviceStatus(data: { id: string }): Observable<{ id: string, temperature: number, isOnline: boolean }>;
}

@Controller('dashboard')
export class GatewayController implements OnModuleInit {
  private telemetryService: TelemetryGrpcService;

  // TODO: Inject the gRPC Client
  constructor(/* Inject ClientGrpc */) {}

  onModuleInit() {
    // TODO: Instantiate the gRPC Service from the client
  }

  @Get('device/:id')
  getDevice(@Param('id') id: string) {
    // TODO: Call the gRPC service and return the observable
  }
}

// ==========================================
// 3. Telemetry Service (gRPC Server)
// ==========================================
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class TelemetryController {

  // TODO: Map this method to the 'GetDeviceStatus' RPC call in the proto file
  getDeviceStatus(data: { id: string }) {
    // Mock database lookup
    return {
      id: data.id,
      temperature: 42.5,
      isOnline: true
    };
  }
}
```

---

## 3. Boss Level Challenge
Implement the full Gateway and Telemetry setup.
1. The **TelemetryController** must use `@GrpcMethod('TelemetryService', 'GetDeviceStatus')` to expose the method over gRPC.
2. The **GatewayController** must inject `@Inject('TELEMETRY_PACKAGE') client: ClientGrpc`.
3. Inside `onModuleInit`, the Gateway must wire up the interface: `this.telemetryService = this.client.getService<TelemetryGrpcService>('TelemetryService')`.
4. The HTTP endpoint must execute the gRPC call and return the result.

<details>
<summary>Click here for Hints</summary>

- For `@GrpcMethod`, ensure the first string exactly matches the `service` name in the `.proto` file, and the second string matches the `rpc` method name.
- NestJS automatically subscribes to the Observable returned by gRPC when you return it directly from an HTTP controller.
</details>

<details>
<summary>Click here for Full Production Solution Walkthrough</summary>

### Full Solution Code

```typescript
import { Module, Controller, Get, Param, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc, ClientsModule, Transport, GrpcMethod } from '@nestjs/microservices';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { Observable } from 'rxjs';

// ==========================================
// 1. Interfaces (Shared across both services)
// ==========================================
interface DeviceId { id: string; }
interface DeviceStatus { id: string; temperature: number; isOnline: boolean; }

interface TelemetryGrpcService {
  getDeviceStatus(data: DeviceId): Observable<DeviceStatus>;
}

// ==========================================
// 2. Telemetry Microservice (gRPC Server)
// ==========================================
@Controller()
export class TelemetryController {

  // Maps to: rpc GetDeviceStatus (DeviceId) returns (DeviceStatus)
  // Inside package: 'telemetry', service: 'TelemetryService'
  @GrpcMethod('TelemetryService', 'GetDeviceStatus')
  getDeviceStatus(data: DeviceId): DeviceStatus {
    console.log(`[gRPC Server] Fetching data for device ${data.id}`);

    // Simulate fast binary response
    return {
      id: data.id,
      temperature: Math.random() * 100, // Mock temperature
      isOnline: true
    };
  }
}

@Module({ controllers: [TelemetryController] })
export class TelemetryModule {}

// ==========================================
// 3. API Gateway (HTTP Client to gRPC Server)
// ==========================================
@Controller('dashboard')
export class GatewayController implements OnModuleInit {
  private telemetryService: TelemetryGrpcService;

  constructor(@Inject('TELEMETRY_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    // Instantiates the gRPC client implementation based on the interface
    this.telemetryService = this.client.getService<TelemetryGrpcService>('TelemetryService');
  }

  @Get('device/:id')
  getDevice(@Param('id') id: string): Observable<DeviceStatus> {
    console.log(`[Gateway] Received HTTP request for ${id}, translating to gRPC...`);
    // Calling the gRPC method. NestJS handles the translation to HTTP JSON response!
    return this.telemetryService.getDeviceStatus({ id });
  }
}

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'TELEMETRY_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'telemetry',
          protoPath: join(__dirname, 'telemetry.proto'), // Path to .proto file
          url: 'localhost:5000' // gRPC port
        },
      },
    ]),
  ],
  controllers: [GatewayController],
})
export class GatewayModule {}

// ==========================================
// 4. Bootstrapping (Context for running both)
// ==========================================
/*
async function bootstrapTelemetry() {
  const app = await NestFactory.createMicroservice(TelemetryModule, {
    transport: Transport.GRPC,
    options: {
      package: 'telemetry',
      protoPath: join(__dirname, 'telemetry.proto'),
      url: 'localhost:5000'
    },
  });
  await app.listen();
}

async function bootstrapGateway() {
  const app = await NestFactory.create(GatewayModule);
  await app.listen(3000);
}
*/
```

### Walkthrough & Architecture Notes
1. **The Protobuf Advantage:** The `.proto` file (implied in the solution) acts as a strict, language-agnostic contract. If you change a field in the proto, both the client and server must conform. Furthermore, data is transmitted as highly compressed binary (Protobuf), making it vastly faster and more network-efficient than JSON strings.
2. **`onModuleInit` Lifecycle:** The "Noob Trap" is trying to instantiate `this.client.getService()` inside the constructor. The client proxy isn't fully ready until the module initializes. Implementing the `OnModuleInit` interface and doing it there ensures the gRPC channel is open and ready.
3. **Automatic Serialization:** Notice how the `GatewayController` simply returns the `Observable<DeviceStatus>`. NestJS automatically waits for the gRPC stream to resolve, intercepts the Protobuf binary, deserializes it back to a JavaScript object, and then re-serializes it to JSON to send down the HTTP wire to the client dashboard.
</details>
