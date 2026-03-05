# BatchData Property Search API Call Example

## What We're Sending

**Endpoint:** `POST https://api.batchdata.com/api/v1/property/search`

**Headers:**
```json
{
  "Authorization": "Bearer YOUR_API_KEY",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "searchCriteria": {
    "compAddress": {
      "street": "2316 Fernwood Drive",
      "city": "Nashville",
      "state": "TN",
      "zip": "37216"
    }
  },
  "options": {
    "useDistance": true,
    "distanceMiles": 1,
    "useBedrooms": true,
    "minBedrooms": -1,
    "maxBedrooms": 1,
    "useBathrooms": true,
    "minBathrooms": -1,
    "maxBathrooms": 1,
    "useArea": true,
    "minAreaPercent": -20,
    "maxAreaPercent": 20,
    "useYearBuilt": true,
    "minYearBuilt": -10,
    "maxYearBuilt": 10,
    "take": 1
  }
}
```

## What We're Getting Back

```json
{
  "results": {
    "properties": [
      {
        "_id": "732d5c35ee7c6b35abb4a7e7a1973890",
        "address": {
          "houseNumber": "2312",
          "streetName": "FERNWOOD DR",
          "streetSuffix": "DR",
          "city": "NASHVILLE",
          "state": "TN",
          "zip": "37216",
          "countyName": "DAVIDSON",
          "fips": "47037"
        },
        "ids": {
          "apn": "061-15-0-182-00"
        },
        "owner": {
          "name1Full": "OWNER NAME",
          "ownerOccupied": false
        }
      }
    ],
    "meta": {
      "results": {
        "resultCount": 1,
        "resultsFound": 856
      }
    }
  }
}
```

## What's MISSING (Should Be Included)

The response should also include these objects for each property:

### `building` object
```json
"building": {
  "bedroomCount": 2,
  "bathroomCount": 1,
  "totalBuildingAreaSquareFeet": 1130,
  "livingAreaSquareFeet": 1130,
  "yearBuilt": 1951,
  "propertyType": "Single Family"
}
```

### `sale` object (or `listing.soldPrice`)
```json
"sale": {
  "lastSale": {
    "salePrice": 450000,
    "saleDate": "2023-08-15"
  }
}
```
OR
```json
"listing": {
  "soldPrice": 450000,
  "soldDate": "2023-08-15",
  "bedroomCount": 2,
  "bathroomCount": 1,
  "totalBuildingAreaSquareFeet": 1130
}
```

### `valuation` object (AVM)
```json
"valuation": {
  "estimatedValue": 425000,
  "confidenceScore": 0.85,
  "asOfDate": "2024-01-15"
}
```

### `assessment` object (Tax Assessment)
```json
"assessment": {
  "totalAssessedValue": 380000,
  "totalMarketValue": 390000,
  "taxYear": 2023
}
```

## The Problem

We're getting filtered results correctly (1 out of 856 properties within 1 mile matching all criteria), but **only basic data** (address, owner, APN).

We need the property details (building, sale, valuation, assessment) to calculate:
- Price per square foot
- Comparable valuations
- Median comp prices

## Question for BatchData Support

**How do we request the full property details in the Property Search API response?**

Is there a parameter like:
- `includePropertyDetails: true`
- `fields: ["building", "sale", "valuation", "assessment"]`
- `detailed: true`
- Or a different endpoint we should use for comp searches that includes property details?

The documentation mentions "Technically you can return the property details as part of your comp call on the Property Search API" but doesn't specify HOW to request those fields.
