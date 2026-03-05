The BatchData Property Search API enables developers to integrate the means for searching and retrieving detailed information on real-estate properties. The API implements a very robust search grammar designed to support a wide-range of use cases.

For example, search criteria can be defined to:

Return a list of properties located in a particular geographic location. This is accomplished using a simple syntax where the location is specified using a single text string. For example, to search for properties in a city, simply set the search criteria query string to "Phoenix, AZ".

Return a list of properties that are comparable to a subject property. The comparables search grammar supports the ability apply search criteria that are relative to the subject property. For example, returning comparable properties whose living area square footage is within a certain percentage of the subject property, or within a certain radius of the subject property.

Return a list of properties that match certain characteristics of the property owner. For example, returning a list of properties where the total number of properties owned by the property owner is greater than a certain value.

Setting up the search criteria
The Property Search API accepts two primary JSON objects as input parameters, searchCriteria and options.

The searchCriteria object is used to specify what properties should be returned in the search results. The options object is used to further refine the API response and to control how many records to retrieve in each request.

searchCriteria has multiple properties to define the filtering criteria, out of which query is the most commonly used property. This property expects a US location such as a city, county, zip code, or State.

To help you understand better, let's look at some of the examples.

Retrieving a list of the properties in Phoenix, Arizona can be done by setting the query parameter to specify the location:

{
"searchCriteria": {
"query": "Phoenix, AZ"
}
}

Searching for properties in Phoenix whose last sale price was between $50,000 and $100,000 can be achieved by adding additional search conditions:

{
"searchCriteria": {
"query": "Phoenix, AZ",
"sale": {
"lastSalePrice": {
"min": 50000,
"max": 100000
}
}
}
}

The search results can be further refined to return a list of properties whose last sale prices fall within the $50,000 - $100,000 range and with lot sizes ranging between 0.1- 0.5 acres:

{
"searchCriteria": {
"query": "Phoenix, AZ",
"sale": {
"lastSalePrice": {
"min": 50000,
"max": 100000
}
},
"lot": {
"lotSizeAcres": {
"min": 0.1,
"max": 0.5
}
}
}
}

Note: All search conditions are AND'ed together and have the net effect of further reducing the number of properties that are returned in the search results.

Search criteria with numeric values
The two examples just shown used additional search criteria that accept numeric values. The search grammar for numeric search attributes allows for a minium and a maximum value to be specified. The min and max operators can be combined to specify a range of values, or they can be used on their own. For example, to match properties that have a lot size of at least 2 acres, just specify the min value:

{
"searchCriteria": {
"query": "Phoenix, AZ",
"sale": {
"lastSalePrice": {
"min": 50000,
"max": 100000
}
},
"lot": {
"lotSizeAcres": {
"min": 2
}
}
}
}

The following search criteria matches properties whose last sale price did not exceed $100k. No minimum value is specified. This search is more concisely expressed as "Properties in Phoenix, AZ with a last sale price <= $100k and a minimum lot size of 2 acres":

{
"searchCriteria": {
"query": "Phoenix, AZ",
"sale": {
"lastSalePrice": {
"max": 100000
}
},
"lot": {
"lotSizeAcres": {
"min": 2
}
}
}
}

Search criteria with numeric values
Date based search criteria have a similar search grammar to numeric values. The minDate and maxDate operators can be used in combination or by themselves.

Here is an example of a search for properties with auction dates that are scheduled to occur in the next 7 days. The example assumes that the current date is December 8, 2024:

{
"searchCriteria": {
"query": "Phoenix, AZ",
"foreclosure": {
"auctionDate": {
"minDate": "2024-12-09",
"maxDate": "2024-12-15"
}
}
}
}

This example returns properties that which were sold in the past 12 months assuming the current date is December 8, 2024. Note that we are using the intel.lastSold attribute. intel.lastSold is a composite attribute that considers both the sale.lastSaleDate and listing.soldDate when applying the search criteria:

{
"searchCriteria": {
"query": "Phoenix, AZ",
"intel": {
"lastSoldDate": {
"minDate": "2023-12-08"
}
}
}
}

Search criteria with text values
Now let's introduce some search conditions that make use of text values. The BatchData search grammar supports a robust set of operators for applying text based search conditions.

Consider the following search for residential properties:

{
"searchCriteria": {
"query": "Phoenix, AZ",
"general": {
"propertyTypeCategory": {
"equals": "Residential"
}
}
}
}

The equals operator is used to match properties where general.propertyTypeCategory = "Residential".

We can further refine our search results to only return certain types of residential properties by making use of the inList operator to specify a list of values that the propertyTypeDetail attribute must match:

{
"searchCriteria": {
"query": "Phoenix, AZ",
"general": {
"propertyTypeCategory": {
"equals": "Residential"
},
"propertyTypeDetail": {
"inList": ["Single Family", "Multi-Family"]
}
}
}
}
The inList operator is effectively OR'ing the values in the array. The previous search is more concisely expressed as properties where the propertyTypeCategory = "Residential" AND the propertyTypeDetail is "Single Family" OR "Multi-Family".

The complete list of values that can be applied to general.propertyTypeCategory and general.propertyTypeDetail criteria are documented in the "Property Search/Property Lookup API, List Builder codes and descriptions" data dictionary.

Advanced location searches
While the query property provides the easiest way to search by location, it is limited to searching a single location. We can take advantage of the robust text search grammar to create more advanced location searches.

Searching multiple locations
A common use case is to identify properties located in a specific list of cities, counties, or zip codes. This can be accomplished by using the address property in conjunction with the inList operator.

For example, let's say you want to match properties in 3 cities. We omit the query property and instead make use of the address.cityState property :

{
"searchCriteria": {
"address": {
"cityState": {
"inList": ["Phoenix, AZ", "Tempe, AZ", "Chandler, AZ"]
}
}
}
}

The same search results can be accomplished using address.city and address.state:

{
"searchCriteria": {
"address": {
"city": {
"inList": ["Phoenix", "Tempe", "Chandler"]
},
"state": {
"equals": "AZ"
}
}
}
}

Let's say the desired outcome is to search for properties in a couple of counties while excluding properties in certain zip codes. Here we can make use the notInList operator:

{
"searchCriteria": {
"address": {
"county": {
"inList": ["Maricopa", "Pima"]
},
"state": {
"equals": "AZ"
},
"zip": {
"notInList": ["85337", "85390"]
}
}
}
}

The contains operator is a way to apply a partial text match. The contains operator can be combined with the address.locality property to find properties in any neighborhoods that include "village" in their name:
​

{
"searchCriteria": {
"address": {
"county": {
"inList": ["Maricopa", "Pima"]
},
"state": {
"equals": "AZ"
},
"locality": {
"contains": "village"
}
}
}
}

The complete list of text operators is as follows:

equals - search for an exact match

contains - search for results that contain the value

startsWith - search for results that start with the value

endsWith - search for results that end with the value

inList - search for results that match any of the strings in the array

notInList - search for results that match none of the strings in the array

matches - search for results that match all of the strings in the array

Quick Lists
As you can see, the search grammar implemented by the Property Search API provides a lot of flexibility and can be used to define very complex search queries. However BatchData goes one step further by making it easy to implement search conditions for the most common real-estate investor use cases by predefining a large set of search queries. These predefined search queries are called Quick Lists and are accessed using the quickList, quickLists, and orQuickLists search criteria.
​
For example, a common use case for real-estate investors is to identify properties that are owned by individuals that live outside of the state where the property is located. We can easily implement that search by addinging just one additional condition using the absenteeOwnerOutOfState quick list:

{
"searchCriteria": {
"query": "Phoenix, AZ",
"quickList": "out-of-state-absentee-owner"
}
}

Multiple quick lists can be combined using either the quickLists search criteria which AND's the lists, or the orQuickLists search criteria which OR's the lists.

For example, the return properties where the owner is both out of state and is in default of their loan:
​

{
"searchCriteria": {
"query": "Phoenix, AZ",
"quickLists": ["out-of-state-absentee-owner", "notice-of-default"]
}
}

Use the orQuickLists search criteria to return properties where the owner is out of state or is in default of their loan:

{
"searchCriteria": {
"query": "Phoenix, AZ",
"orQuickLists": ["out-of-state-absentee-owner", "notice-of-default"]
}
}

The not operator can be applied to quick lists to negate them. For example, to search for properties where the owner is not an out of state owner but is in default of their loan we simply prefix the quick list with "not-":

{
"searchCriteria": {
"query": "Phoenix, AZ",
"quickLists": ["not-out-of-state-absentee-owner", "notice-of-default"]
}
}

The complete list of quick lists and their descriptions is documented in Property Search/Property Lookup API, List Builder datasets.
​

Structuring The Result
The options is a primary object that enables the customization of search results. It is optional and contains various secondary objects with useful customization functions.

Here are some of the important options:

skip - skip option denotes the number of records you would like to skip from the results and comes handy especially when retrieving paginated results and often needs to be used with take option. If you do not specify any value, Default value 0 is considered.

take - take option denotes the number of property results in response. If no value is specified, the default value 25 is considered. The minimum and maximum values are 1 and 500. (refer example below)

quicklistCounts - This option indicates whether or not you want to see quicklist counts in the response.

dateFormat - A flag indicating whether the date format should be datetime or date

Possible values are "iso-date-time" & "iso-date". When not specified it defaults to "iso-date-time"

{
"searchCriteria": {
"query": "Phoenix, AZ"
},
"options": {
"quicklistCounts": true,
"dateFormat": "iso-date"
}
}

sort - There can be a need where you want the response to show up in a particular order by a particular field. That is where sort options comes handy. It actually takes two inputs; sordOrder & field. sordOrder defines if you want to receive the response in ascending, descending or random order. (denoted as "asc", "desc" or "random"). field option denotes the column by which you want to order the response by. (refer example below)

​[Please note sort option is supported by only for some columns listed below:

bathroomCount, bedroomCount, city, daysOnMarket, equityCurrentEstimatedBalance, estimatedValue, foreclosureStatus, imageCount, lastSalePrice, lastSaleDate, lastSoldDate, lastSoldPrice, livingAreaSquareFeet, mlsStatus, ownerOccupied, price, propertyType, propertyTypeCategory, soldDate, state, totalBuildingAreaSquareFeet, yearBuilt, zip]

{
"searchCriteria": {
"query": "Phoenix, AZ"
},
"options": {
"sort": {
"sortOrder": "asc",
"field": "city"
}
}
}

Configuring this property correctly will help you get the structured result which is easier to understand and to integrate in your application. Some of the properties can also help improve API performance by retrieving a paginated result

More information on all the available properties within searchCriteria and options can be found here
