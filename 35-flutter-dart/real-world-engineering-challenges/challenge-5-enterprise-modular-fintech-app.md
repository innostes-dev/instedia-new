# Challenge 5: Enterprise Micro-App Architecture

## The Challenge Scenario
You are building an Enterprise Banking application. The app has grown to 500,000 lines of code. You have three teams: Core, Trading, and Loans. Currently, everything is in one massive `lib/` folder, causing merge conflicts, massive build times, and tight coupling (e.g., the Trading UI directly imports a Core database helper).

You must refactor this into a "Micro-App" Architecture.
1. The app will be split into multiple local Dart packages.
2. The UI modules must *never* import each other.
3. Navigation will be handled entirely via Deep Linking (String-based routes) using a central router (`go_router`), ensuring strict loose coupling.
4. State is managed via `flutter_bloc`.

## Core Requirements
1. **Package Structure:** Define a multi-package `pubspec.yaml` setup using a workspace or local path dependencies (Core, Feature A, Feature B, Shell App).
2. **GoRouter Implementation:** Set up `go_router` in the Shell App to handle routing via strings (e.g., `context.go('/trading/buy')`).
3. **Dependency Injection:** Use a Service Locator (like `get_it`) in the Shell app to inject repositories defined in Core into the BLoCs defined in the Features.
4. **Demonstrate Loose Coupling:** Show how the Loans feature can navigate to the Trading feature *without* importing the Trading package.

## Starter Template

```dart
// Because this is a multi-package architecture, we simulate the structure in one file for the challenge.

import 'package:flutter/material.dart';

// --- CORE PACKAGE ---
// (Imagine this is in a separate folder: my_bank_core/lib/core.dart)
class UserRepository {
  String getUserLevel() => "Gold";
}

// --- TRADING FEATURE PACKAGE ---
// (Imagine this is in: feature_trading/lib/trading.dart)
// UI and BLoC for Trading. Should NOT import feature_loans.
class TradingScreen extends StatelessWidget {
  const TradingScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text("Trading")));
}

// --- LOANS FEATURE PACKAGE ---
// (Imagine this is in: feature_loans/lib/loans.dart)
class LoansScreen extends StatelessWidget {
  const LoansScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ElevatedButton(
          // TODO: Navigate to Trading without importing it!
          onPressed: () {},
          child: const Text("Go to Trading"),
        )
      )
    );
  }
}

// --- APP SHELL (The Glue) ---
// (Imagine this is the root pubspec.yaml importing all packages)
void main() {
  // TODO: Setup DI and Router
  runApp(const MainBankApp());
}

class MainBankApp extends StatelessWidget {
  const MainBankApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Text("Implement Router Here"),
    );
  }
}
```

## Production Solution Walkthrough

### 1. Folder & Pubspec Structure (Conceptual)
In a real enterprise app, you use a monorepo tool like Melos, or Dart workspaces.
```text
/enterprise_bank
  /core
    pubspec.yaml (No flutter dependencies, pure Dart)
  /features
    /trading
      pubspec.yaml (dependencies: core: path: ../../core)
    /loans
      pubspec.yaml (dependencies: core: path: ../../core)
  /app_shell (The main app)
    pubspec.yaml (dependencies: core, trading, loans)
```

### 2. The Core Package (Dependencies & Contracts)
The core package holds abstractions and models. It never imports Flutter UI.

```dart
// core/lib/repositories.dart
abstract class TradingRepository {
  Future<bool> executeTrade(String ticker, double amount);
}

// core/lib/di.dart
// We use get_it for dependency injection
import 'package:get_it/get_it.dart';
final GetIt locator = GetIt.instance;
```

### 3. Feature Packages (Strictly Isolated)
Features only import `core`. They define their own BLoCs and UI. To navigate, they use `go_router` string paths.

```dart
// feature_trading/lib/trading_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class TradingScreen extends StatelessWidget {
  const TradingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trading Center'), backgroundColor: Colors.green),
      body: Center(
        child: ElevatedButton(
          // Navigating back using GoRouter
          onPressed: () => context.go('/dashboard'),
          child: const Text('Back to Dashboard'),
        ),
      ),
    );
  }
}

// feature_loans/lib/loans_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class LoansScreen extends StatelessWidget {
  const LoansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Loans Center'), backgroundColor: Colors.blue),
      body: Center(
        child: ElevatedButton(
          // LOOSE COUPLING: We navigate to Trading using a string URI.
          // Loans does NOT import the Trading package!
          onPressed: () => context.go('/trading'),
          child: const Text('Invest your loan in Trading'),
        ),
      ),
    );
  }
}
```

### 4. The App Shell (The Glue)
The App Shell is the only package allowed to import everything. It wires up Dependency Injection and the Router.

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
// Imaginary imports:
// import 'package:core/core.dart';
// import 'package:feature_trading/trading.dart';
// import 'package:feature_loans/loans.dart';

void main() {
  // 1. Setup Dependency Injection (Service Locator)
  // locator.registerLazySingleton<TradingRepository>(() => ApiTradingRepository());

  runApp(const EnterpriseBankApp());
}

// 2. Define the Central Router
final GoRouter _router = GoRouter(
  initialLocation: '/dashboard',
  routes: [
    GoRoute(
      path: '/dashboard',
      builder: (context, state) => const DashboardScreen(),
    ),
    GoRoute(
      path: '/trading',
      builder: (context, state) => const TradingScreen(), // From Trading Package
    ),
    GoRoute(
      path: '/loans',
      builder: (context, state) => const LoansScreen(), // From Loans Package
    ),
  ],
);

class EnterpriseBankApp extends StatelessWidget {
  const EnterpriseBankApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      routerConfig: _router,
      title: 'Enterprise Bank',
    );
  }
}

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton(onPressed: () => context.go('/trading'), child: const Text("Go to Trading")),
          const SizedBox(height: 10),
          ElevatedButton(onPressed: () => context.go('/loans'), child: const Text("Go to Loans")),
        ],
      ),
    );
  }
}
```

### 5. Architecture Diagram
```text
[ App Shell ] (main.dart, GoRouter, GetIt DI)
  |
  |--- imports ---> [ Feature: Trading ] (Trading UI, Trading BLoC)
  |                       |
  |--- imports ---> [ Feature: Loans ] (Loans UI, Loans BLoC)
  |                       |
  |--- imports ---> [ Core ] (Models, abstract Repos, Network Client)
                          ^
                          |
Feature Modules ONLY import Core. They NEVER import each other.
When Feature Loans needs to open Trading, it fires `context.go('/trading')`.
The App Shell's router intercepts this string and loads the Trading UI.
```

## Pro Tips for Production
- **Feature Flags & Dynamic Delivery:** Because the App Shell controls routing, you can easily implement Feature Flags. If a user doesn't have the "Trading" tier, the router can intercept `context.go('/trading')` in a middleware redirect and route them to a "Upgrade Plan" screen instead, without the Loans module needing to know anything about the user's tier.
- **Micro-Frontends (Deferred Components):** On Android, you can compile these independent feature packages as "Deferred Components." The Trading module won't even be downloaded to the user's phone from the Play Store until they click the "Trading" button for the first time, keeping your initial app install size tiny.