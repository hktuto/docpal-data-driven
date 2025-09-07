# DocPal Node Client - Web Application

A modern web application built with Nuxt 4, featuring a layered architecture, authentication system, and comprehensive internationalization support.

## Features

- **Nuxt 4**: Latest version with Vue 3 Composition API
- **TypeScript**: Full TypeScript support with strict mode
- **Layered Architecture**: Modular features using Nuxt layers
- **Authentication**: Global middleware-based authentication system
- **Internationalization**: Multi-language support (en-US, zh-CN, zh-HK)
- **Element Plus**: Modern Vue 3 UI component library
- **SCSS Styling**: Advanced styling with SCSS and CSS custom properties
- **Server Health Monitoring**: Built-in server connectivity monitoring
- **Event Bus System**: Global event handling for application state

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm generate` - Generate static site
- `pnpm preview` - Preview production build
- `pnpm getApi` - Generate API client from OpenAPI specification

## Project Structure

```
apps/web/
├── app/                   # Core application
│   ├── middleware/        # Global middleware (authentication)
│   ├── composables/       # Vue composables (auth, serverHealth, etc.)
│   ├── components/        # Shared Vue components
│   │   ├── app/          # App-specific components (menu, contextmenu, tab)
│   │   ├── svg/          # SVG icon components
│   │   └── LoadingBg/    # Loading and background components
│   ├── pages/            # Application pages (index, login, server-down)
│   ├── plugins/          # Nuxt plugins (Element Plus, i18n, serverHealth)
│   ├── utils/            # Utility functions and TypeScript types
│   ├── assets/           # Stylesheets and assets
│   │   └── styles/       # SCSS files and Element Plus customizations
│   ├── app.vue          # Root Vue component
│   └── app.config.ts    # Application configuration
├── layers/               # Nuxt layers for modular features
│   ├── auth/            # Authentication layer
│   ├── browse/          # Browse functionality layer
│   ├── companyProfile/  # Company profile management layer
│   ├── companyUser/     # Company user management layer
│   └── tabs/            # Tab system layer
├── i18n/                # Internationalization
│   ├── locales/         # Translation files (en-US, zh-CN, zh-HK)
│   └── i18n.config.ts   # i18n configuration
├── public/              # Static assets
│   └── icons/          # Organized icon assets
├── nuxt.config.ts       # Nuxt configuration
└── package.json         # Dependencies and scripts
```

## Architecture

### Layered Architecture
The application uses Nuxt layers to organize features into modular, self-contained units. Each layer has its own:
- Components
- Pages
- Composables
- Configuration

### Key Technologies
- **Vue 3** with Composition API
- **TypeScript** with strict type checking
- **Element Plus** for UI components
- **SCSS** for styling (no Tailwind CSS)
- **Nuxt 4** for SSR/SPA capabilities

### Authentication System
Global authentication middleware (`auth.global.ts`) protects routes and manages user sessions.

### Event System
Built-in event bus system for global application state management and communication between components.

## Development

For detailed development guidelines, see the [Development Guide](../docs/content/getting-started.md#development-guide) in the documentation.
