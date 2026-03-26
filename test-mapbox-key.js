// Quick test to verify environment variable is loaded
// Run with: node test-mapbox-key.js

require('dotenv').config({ path: '.env.local' });

console.log('NEXT_PUBLIC_MAPBOX_API_KEY:', process.env.NEXT_PUBLIC_MAPBOX_API_KEY);
console.log('Key starts with pk.?', process.env.NEXT_PUBLIC_MAPBOX_API_KEY?.startsWith('pk.'));
