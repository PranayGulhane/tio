# StyleMirror - Virtual Try-On Platform

## Overview

StyleMirror is an AI-powered virtual try-on platform that enables clothing stores to offer customers digital outfit previews using Gemini 2.0 Flash image generation. The platform serves three distinct user roles: Company Owners (platform administrators), Store Managers (store administrators), and Customers (end users accessing via QR codes). The system provides centralized usage analytics, clothing inventory management, and a seamless virtual try-on experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, built using Vite as the build tool and development server.

**UI Component System**: Implements shadcn/ui (New York style) with Radix UI primitives for accessible, unstyled components. The design system follows a hybrid approach - Material Design principles for admin dashboards (data clarity and enterprise feel) and Shopify-inspired modern retail experience for customer interfaces.

**Styling**: Tailwind CSS with CSS variables for theming, supporting both light and dark modes. Custom design tokens defined in `index.css` with careful attention to elevation, borders, and interactive states.

**State Management**: 
- TanStack Query (React Query) for server state management with custom query client configuration
- React Context API for authentication state and theme preferences
- Local component state with React hooks

**Routing**: Wouter for lightweight client-side routing with role-based protected routes.

**Form Handling**: React Hook Form with Zod schema validation via @hookform/resolvers.

**Design Rationale**: The component library approach with shadcn/ui was chosen over a monolithic UI framework to maintain flexibility and reduce bundle size. The hybrid design system addresses the distinct needs of admin users (data-focused) versus customers (experience-focused).

### Backend Architecture

**Runtime**: Node.js with Express.js framework running in ESM mode.

**API Design**: RESTful API with route handlers organized in `server/routes.ts`. Authentication uses JWT tokens stored in localStorage on the client.

**File Upload Strategy**: Multer middleware with disk storage, organizing uploads into separate directories (`/uploads/clothing`, `/uploads/customers`, `/uploads/results`). This separates concerns and makes file management clearer.

**Image Generation**: Integration with Google Gemini 2.0 Flash (preview image generation model) for virtual try-on functionality. The service reads user photos and clothing images, sends them to Gemini with a carefully crafted prompt, and saves generated results.

**Security Considerations**:
- Password hashing with bcryptjs
- JWT-based authentication with configurable secret
- Role-based access control enforced at route level
- Session expiration for customer QR sessions

**Rationale**: Express.js provides a lightweight, flexible foundation. The JWT approach was chosen over session-based auth for scalability and statelessness. Separating storage logic into `server/storage.ts` creates a clear abstraction layer that could be easily swapped for different data access patterns.

### Data Storage

**Database**: PostgreSQL accessed via Neon's serverless driver (@neondatabase/serverless) with WebSocket support for serverless environments.

**ORM**: Drizzle ORM chosen for type-safety and lightweight footprint compared to heavier alternatives like Prisma. Schema defined in `shared/schema.ts` with Zod integration for runtime validation.

**Schema Design**:
- `users`: Stores company owners and store managers with role-based differentiation
- `stores`: Store information and metadata
- `clothingItems`: Inventory with categories, barcodes, and try-on counts
- `qrSessions`: Time-limited session tokens for customer access
- `customerSessions`: Active customer sessions with expiration tracking
- `tryOnHistory`: Audit trail of try-on operations
- `usageLogs`: Analytics data for platform monitoring

**Migration Strategy**: Drizzle Kit for schema migrations with configuration in `drizzle.config.ts`.

**Rationale**: PostgreSQL provides robust relational data capabilities needed for multi-tenant architecture. Neon's serverless driver aligns with deployment on platforms like Replit. The separation of concerns between authentication (users), business logic (stores/clothing), and ephemeral access (sessions) creates clear boundaries.

### External Dependencies

**AI Service**: Google Generative AI (@google/genai) specifically using the "gemini-2.0-flash-preview-image-generation" model for virtual try-on image generation. This model was selected as the only Gemini model supporting image generation output.

**Database Provider**: Neon Database (serverless PostgreSQL) accessed via @neondatabase/serverless with WebSocket constructor override for Node.js environments.

**Image Processing**: QRCode library for generating QR codes that encode session tokens for customer access.

**Authentication**: 
- bcryptjs for password hashing
- jsonwebtoken for JWT token generation and verification

**File Upload**: Multer for handling multipart/form-data file uploads with disk storage strategy.

**TypeScript Tooling**: tsx for running TypeScript in development, esbuild for production builds with selective bundling of dependencies to optimize cold start times.

**Development Tools**:
- Replit-specific plugins for development banner and error overlay
- Vite plugins for hot module replacement and React Fast Refresh

**Rationale**: The Gemini integration provides state-of-the-art image generation without requiring separate computer vision models. Neon's serverless architecture eliminates database connection pooling concerns. The selective bundling strategy (allowlist in build.ts) balances cold start performance with dependency management.