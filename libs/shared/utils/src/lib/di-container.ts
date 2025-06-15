/**
 * AegisX Platform - DI Container using TSyringe
 * Simple wrapper around TSyringe for better developer experience
 */
import 'reflect-metadata';
import { container, injectable, inject, singleton } from 'tsyringe';

// Service tokens (use string tokens for simplicity)
export const TOKENS = {
    DATABASE: 'DATABASE',
    LOGGER: 'LOGGER',
    CONFIG: 'CONFIG',
    USER_SERVICE: 'USER_SERVICE',
    AUTH_SERVICE: 'AUTH_SERVICE',
} as const;

// Re-export TSyringe decorators for convenience
export { injectable, inject, singleton };

// AegisX DI Container - wrapper around TSyringe
export class AegisXContainer {
    private static instance: AegisXContainer;

    static getInstance(): AegisXContainer {
        if (!AegisXContainer.instance) {
            AegisXContainer.instance = new AegisXContainer();
        }
        return AegisXContainer.instance;
    }

    /**
     * Register a service factory (creates new instance every time)
     */
    register<T>(token: string, factory: () => T): this {
        container.register(token, { useFactory: factory });
        return this;
    }

    /**
     * Register a singleton service
     */
    registerSingleton<T>(token: string, factory: () => T): this {
        const instance = factory();
        container.registerInstance(token, instance);
        return this;
    }

    /**
     * Register an instance
     */
    registerInstance<T>(token: string, instance: T): this {
        container.registerInstance(token, instance);
        return this;
    }

    /**
     * Register a class (auto-resolve dependencies)
     */
    registerClass<T>(token: string, constructor: new (...args: any[]) => T): this {
        container.register(token, { useClass: constructor });
        return this;
    }

    /**
     * Resolve a service
     */
    resolve<T>(token: string): T {
        return container.resolve(token);
    }

    /**
     * Check if service is registered
     */
    has(token: string): boolean {
        return container.isRegistered(token);
    }

    /**
     * Clear all services (useful for testing)
     */
    clear(): void {
        container.clearInstances();
    }

    /**
     * Get underlying TSyringe container for advanced usage
     */
    getContainer() {
        return container;
    }
}

// Global container instance
export const diContainer = AegisXContainer.getInstance(); 