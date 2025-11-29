# Virtual Try-On Application - Design Guidelines

## Design Approach

**Hybrid Strategy**: Admin dashboards follow **Material Design** principles for data clarity and enterprise feel. Customer interface draws inspiration from **Shopify** and **modern retail experiences** for engaging, conversion-focused design.

## Typography

**Font Stack**: 
- Primary: Inter (Google Fonts) - modern, professional, excellent readability
- Accent: DM Sans (Google Fonts) - for headings and emphasis

**Hierarchy**:
- H1: text-4xl md:text-5xl font-bold (dashboard titles)
- H2: text-2xl md:text-3xl font-semibold (section headers)
- H3: text-xl font-semibold (card titles, subsections)
- Body: text-base leading-relaxed (general content)
- Small: text-sm (metadata, labels)
- Tiny: text-xs (timestamps, helper text)

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Component padding: p-4, p-6, p-8
- Section margins: mb-8, mb-12, mb-16
- Grid gaps: gap-4, gap-6, gap-8
- Container padding: px-4 md:px-8 lg:px-12

**Grid Structure**:
- Admin dashboards: 12-column grid with sidebar (aside: w-64, main: flex-1)
- Customer interface: Full-width with max-w-7xl container
- Card layouts: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4

## Component Library

### Navigation
**Admin Sidebar**: Fixed left sidebar (w-64) with logo at top, role-specific menu items, user profile at bottom. Each menu item with icon (Heroicons) + label, active state indicator (left border accent).

**Customer Header**: Sticky top header with store branding, session timer countdown, minimal navigation.

### Dashboards (Company Owner & Store Manager)

**Stats Cards**: Grid of metric cards with large numbers, labels, trend indicators (↑↓), subtle icons. Each card: rounded-lg, p-6, with micro-animation on hover (subtle scale).

**Data Tables**: Clean tables with alternating row backgrounds, sortable headers, action buttons (icon-only for tight spacing). Pagination at bottom.

**Charts**: Line/bar charts for analytics using a charting library. Minimal gridlines, clear labels, tooltips on hover.

### Store Management

**Clothing Item Cards**: 
- Aspect ratio 3:4 for product images
- Image with overlay on hover showing quick actions (edit, delete, toggle availability)
- Badge for availability status (top-right corner)
- Category tag, barcode display below image
- All in rounded-xl cards with subtle shadow

**Upload Zone**: Large dashed border dropzone with icon, "Drag & drop or click to upload" text, file format/size guidelines.

**QR Code Generator**: Centered modal with generated QR code, expiry timer, download/print buttons, share instructions.

### Customer Try-On Interface

**Photo Upload Section**: Hero-style full-width section with:
- Large camera icon or illustration
- "Upload Your Photo" heading (text-3xl)
- Dropzone or camera capture button (primary CTA)
- Privacy message (text-sm, reassuring copy about auto-deletion)

**Clothing Browser**:
- Filter bar: Horizontal pill buttons for categories with active state
- Barcode scanner button (prominent, with camera icon)
- Grid layout: grid-cols-2 md:grid-cols-3 lg:grid-cols-4 with clothing cards
- Each card: Image, name, category badge, "Select" checkbox/toggle

**Try-On Results**:
- Split view: Original photo | Generated try-on (side by side on desktop, stacked on mobile)
- Download button for each result
- "Try Another" CTA to restart process
- Loading state: Skeleton screens with shimmer effect during AI generation

### Forms
**Input Fields**: 
- Consistent styling: rounded-lg, border-2, p-3
- Label above (text-sm font-medium)
- Focus state with ring (ring-2 ring-offset-2)
- Error state with red border + helper text
- Icons inside inputs where relevant (email, password)

**Buttons**:
- Primary: Solid with rounded-lg, px-6 py-3, font-semibold
- Secondary: Outlined with transparent background
- Icon buttons: Square/circular for compact actions
- Disabled state: Reduced opacity (opacity-50) + no hover

### Overlays
**Modals**: Centered with backdrop blur (backdrop-blur-sm), max-w-2xl, rounded-2xl, shadow-2xl. Close button (X) top-right.

**Toasts**: Top-right notifications, slide-in animation, auto-dismiss after 5s. Success/error/info variants with appropriate icons.

## Special Elements

**Session Timer** (Customer): Countdown badge in header, changes to warning state when <15 minutes remain, urgent state when <5 minutes.

**Empty States**: Illustrations or large icons with helpful messaging and primary CTA. For empty clothing inventory, QR sessions, try-on history.

**Loading States**: 
- Skeleton screens for content loading
- Spinner for actions in progress
- Progress bar for multi-step processes (photo upload → AI generation)

## Animations

**Minimal & Purposeful**:
- Card hover: subtle scale (scale-105) + shadow increase
- Button press: slight scale down (scale-95)
- Modal/toast: Slide/fade transitions (200-300ms)
- No scroll-triggered animations
- Loading spinners for AI generation (pulse effect)

## Responsive Behavior

**Breakpoints**:
- Mobile-first approach
- Admin sidebar: Converts to bottom nav on mobile
- Tables: Horizontal scroll on mobile or card transformation
- Customer grid: 2 columns mobile → 4 columns desktop
- Stats cards: 1 column mobile → 2-3-4 progression

## Images

**Hero Section** (Customer Landing): Full-width hero on customer QR entry with:
- Professional fashion retail imagery (mannequins, store environment, or AI-generated try-on examples)
- Overlay with welcome message + store name
- CTA button with blurred background (backdrop-blur-md bg-white/30)
- Height: h-96 md:h-[500px]

**Clothing Images**: 
- Consistent aspect ratio (3:4 portrait)
- object-cover to fill card areas
- Lazy loading for performance
- Placeholder while loading

**Profile/Store Logos**: Circular avatars (rounded-full) for user profiles, square logos for store branding

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support for dashboards
- Focus indicators (ring styles)
- Sufficient contrast ratios
- Alt text for all images
- Screen reader announcements for status changes (try-on generation complete, session expiring)