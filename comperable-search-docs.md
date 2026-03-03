B
Written by BatchData Support
Updated over 5 months ago
Table of contents
The BatchData Property Search API also allows searching for comparable properties by specifying a subject property and defining the characteristics of the comparables. For Example:

Distance from Subject Property

Number of Bedrooms

Number of Bathrooms

Number of Stories

Living Area of the Property (Square Feet)

Lot Size

Built Year

Setting up the comparable property search criteria
For finding the comparable properties for a subject property you need to use the Property Search API which accepts two primary JSON objects as input parameters, searchCriteria and options.

The searchCriteria object is used to specify the subject property for which you want to search the comparable properties for. The options object is used to further refine the API response and to control how many records to retrieve in each request.

searchCriteria has multiple properties (attributes) to define the filtering criteria, out of which compAddress is a must in this case. This attribute takes the subject property address in terms of separate address components i.e. street, city, state & zip

Here is an example of how the query looks like.

Searching for Comparable properties for Subject Property "622 W Palmaire Ave, Phoenix, AZ,85021-8767" can be done as below:

{
"searchCriteria": {
"compAddress": {
"street": "622 W Palmaire Ave",
"city": "Phoenix",
"state": "AZ",
"zip": "85021"
}
}
}

For above query the comp algorithm is going to return thousands of comparable properties nationwide. Thus to get down the results to relevant properties following filtering options shall be used.

1.Distance from Subject Property: To use the distance filter you need to include "useDistance" option in "options" part of the query.

Example below shows how to search for comparable properties within 1 mile of the subject property.

{
"searchCriteria": {
"compAddress": {
"street": "622 W Palmaire Ave",
"city": "Phoenix",
"state": "AZ",
"zip": "85021-8767"
}
},
"options": {
"useDistance": true,
"distanceMiles": 1
}
}

2. Number of Bedrooms & Bathroom : To refine the search results further, number of bedrooms or bathrooms can be used as well. To do that "useBedrooms" or/& "useBathrooms" option in "options" part of the query.

Example below shows how to search for comparable properties that have bedrooms & bathrooms counts within +1 or -1 of the subject property:

{
"searchCriteria": {
"compAddress": {
"street": "622 W Palmaire Ave",
"city": "Phoenix",
"state": "AZ",
"zip": "85021-8767"
}
},
"options": {
"useBathrooms": true,
"minBathrooms": -1,
"maxBathrooms": 1,
"useBedrooms": true,
"minBedrooms": -1,
"maxBedrooms": 1
}
}

3. Number of Stories: Number of stories is another filter that can be used to refine the search. This can be achieved by using "useStories" option in "options" part of the query.

Example below shows how to search for comparable properties that have a story count within +1 or -1 of the subject property.

{
"searchCriteria": {
"compAddress": {
"street": "622 W Palmaire Ave",
"city": "Phoenix",
"state": "AZ",
"zip": "85021-8767"
}
},
"options": {
"useStories": true,
"minStories": -1,
"maxStories": 1
}
}

4. Living Area of the Property (Square Feet): Resultant comparable properties can also be filtered using the Living Area. This can be achieved by using "useArea" option in "options" part of the query.

Example below shows how to search for comparable properties that have living area within +20% or -20% of the subject property.

{
"searchCriteria": {
"compAddress": {
"street": "622 W Palmaire Ave",
"city": "Phoenix",
"state": "AZ",
"zip": "85021-8767"
}
},
"options": {
"useArea": true,
"minAreaPercent": -20,
"maxAreaPercent": 20
}
}

5. Built Year: Another way to increase the focus on relevant comparable properties is to use Built Year. This can be achieved by using "useYearBuilt" option in "options" part of the query.

Example below shows how to search for comparable properties that were built within +10 years or -10 years of the subject property.

{
"searchCriteria": {
"compAddress": {
"street": "622 W Palmaire Ave",
"city": "Phoenix",
"state": "AZ",
"zip": "85021-8767"
}
},
"options": {
"useYearBuilt": true,
"minYearBuilt": -20,
"maxYearBuilt": 20
}
}

More ways to filter results of comparable property search:
Above mentioned filters used within "options" object can be combined with other filtering options in "searchCriteria" object to further refine the results as below:

[For detailed guidance on filtering methods via "searchCriteria" object, please refer to Introduction to the property search api]

E.g. Refining the search for comparable properties by Property Class & Property type can be achieved as below:

{
"searchCriteria": {
"compAddress": {
"street": "622 W Palmaire Ave",
"city": "Phoenix",
"state": "AZ",
"zip": "85021-8767"
},
"general": {
"propertyTypeCategory": {
"inList": [
"Residential"
]
},
"propertyTypeDetail": {
"inList": [
"Single Family"
]
}
}
}
}
