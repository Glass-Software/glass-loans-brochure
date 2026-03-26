# Demo Mode - Testing the Zillow-Style UI

Demo mode allows you to quickly test the new Zillow-style comps UI without going through the entire underwriting flow.

## How to Use Demo Mode

### Quick Start (Recommended)

**Just navigate to the demo page:**
```
http://localhost:3000/underwrite/demo
```

This will:
1. ✅ Load all data from "514 Betty Lou Drive" submission
2. ✅ Pre-fill all form fields
3. ✅ Automatically jump to Step 6 (Comp Selection)
4. ✅ Show the Zillow-style UI immediately

**No form filling required!**

### Alternative: URL Parameter Method

1. **Add `?demo=true` to the URL:**
   ```
   http://localhost:3000/underwrite?demo=true
   ```

2. **Navigate through the steps** until you reach Step 6 (Comp Selection)

3. **Step 6 will automatically load** data from the existing submission:
   - Property: **514 Betty Lou Drive**
   - Email: **hervey711@gmail.com**

### What Gets Loaded

When demo mode is active, Step 6 will load:
- ✅ Property details (address, purchase price, rehab, etc.)
- ✅ All comparable properties from the real submission
- ✅ Comp selection state (emphasized/normal/removed)
- ✅ Property coordinates for map display

### Demo Mode Indicator

When demo mode is active, you'll see a yellow warning banner at the top of Step 6:
```
🎨 Demo Mode: Showing data from 514 Betty Lou Drive
```

## Testing Checklist

Use demo mode to test:

### Desktop Layout
- [ ] Map displays on left (~65% width)
- [ ] Resizable drawer on right with comp cards
- [ ] Drag handle works to resize drawer
- [ ] Sort dropdown changes comp order
- [ ] Click map marker → scrolls to comp card
- [ ] Comp card highlights temporarily (2 seconds)
- [ ] Buttons appear on hover

### Mobile Layout
- [ ] Map/List toggle buttons visible
- [ ] Toggle switches between views
- [ ] Map view shows full-screen map
- [ ] List view shows scrollable comp cards
- [ ] Sort dropdown above toggle
- [ ] Buttons always visible (no hover needed)

### Comp Cards
- [ ] Square card format
- [ ] Emphasized comps show green border
- [ ] Normal comps show blue border
- [ ] Removed comps show gray border and opacity
- [ ] Emphasize/Normal/Remove buttons work
- [ ] Minimum 3 comps validation works

### Sorting
- [ ] Distance (closest) - default
- [ ] Price (highest)
- [ ] Price (lowest)
- [ ] Sqft (highest)
- [ ] Sqft (lowest)
- [ ] Year (newest)
- [ ] Year (oldest)
- [ ] $/sqft (highest)
- [ ] $/sqft (lowest)

## Production Use

Demo mode is **only available in development** by default. To enable in production:

1. Set environment variable:
   ```bash
   DEMO_MODE_KEY=your-secret-key-here
   ```

2. Pass the key in the request:
   ```
   http://your-domain.com/underwrite?demo=true&demoKey=your-secret-key-here
   ```

**Security Note:** The demo data endpoint will reject requests in production unless:
- Running in development mode (`NODE_ENV=development`), OR
- Valid demo key is provided

## Customizing Demo Data

To use a different submission for demo mode:

Edit [src/components/Underwriting/Step6CompSelection.tsx](src/components/Underwriting/Step6CompSelection.tsx):

```typescript
const response = await fetch("/api/underwrite/demo-data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "your-email@example.com",  // Change this
    propertyAddress: "your property",  // Change this (partial match works)
  }),
});
```

## Troubleshooting

**Demo mode not working?**
- Check that you're on Step 6 (Comp Selection)
- Ensure the submission exists in the database
- Check browser console for errors
- Verify `?demo=true` is in the URL

**No demo data indicator?**
- The yellow banner only appears when data is successfully loaded
- If loading fails, you'll see an error message instead

**Want to test without demo mode?**
- Simply remove `?demo=true` from the URL
- Step 6 will fetch comps normally via the API
