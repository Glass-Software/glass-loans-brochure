/**
 * Test script for Rentcast AVM API
 * Usage: npx tsx scripts/test-rentcast-avm.ts
 */

async function testRentcastAVM() {
  const apiKey = process.env.RENTCAST_API_KEY;

  if (!apiKey) {
    console.error('❌ RENTCAST_API_KEY environment variable is not set');
    process.exit(1);
  }

  const params = new URLSearchParams({
    address: '105 Lakeview Street',
    propertyType: 'Single Family',
    bedrooms: '2',
    bathrooms: '1',
    squareFootage: '1020',
    lookupSubjectAttributes: 'true',
    maxRadius: '3',
    daysOld: '365',
    compCount: '25',
  });

  const url = `https://api.rentcast.io/v1/avm/value?${params}`;

  console.log('🔄 Sending request to Rentcast AVM API...');
  console.log('URL:', url);
  console.log('\nHeaders:');
  console.log('  X-Api-Key:', apiKey.substring(0, 10) + '...');
  console.log('  Accept: application/json');
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    console.log('Status:', response.status, response.statusText);
    console.log('');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:');
      console.error(errorText);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ Success! Response:');
    console.log(JSON.stringify(data, null, 2));

    // Summary
    if (data.price) {
      console.log('\n📊 Summary:');
      console.log(`  Estimated Value: $${data.price.toLocaleString()}`);
      console.log(`  Price Range: $${data.priceRangeLow?.toLocaleString()} - $${data.priceRangeHigh?.toLocaleString()}`);
      console.log(`  Comparables: ${data.comparables?.length || 0}`);
    }
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
    process.exit(1);
  }
}

testRentcastAVM();
