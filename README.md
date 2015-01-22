UofT Course API
==============
This is a service that is currently in development by [Qasim Iqbal](https://github.com/Qasim) and [Ivan Zhang](https://github.com/ivanzhangsolutions).

The goal is to provide a RESTful web API that can allow developers to create applications to help make course selection easier for students at UofT.

We want our database to be self-sufficient (fully automated, with no user-required actions). We also want the API itself to be easy to understand and use, but yet still very comprehensive in what it can provide to a developer.

Web Scraper
---------------
We are working on web scrapers for the following web services that are provided by UofT:

 - [Course Finder](http://coursefinder.utoronto.ca/)
 - [A&S Fall/Winter Timetable](http://www.artsandscience.utoronto.ca/ofr/timetable/winter/sponsors.htm) + [A&S Summer Timetable](http://www.artsandscience.utoronto.ca/ofr/timetable/summer/sponsors.htm)
 - [UTM Timetable Planner](https://student.utm.utoronto.ca/timetable/)
 - [UTSC Course Timetable](http://www.utsc.utoronto.ca/~registrar/scheduling/timetable)

Each scraper should have the following properties:

 1. A python file that holds the class for the specific scraper.
 2. A folder called “html” that holds all the raw HTML.
 3. A folder called “json” that holds all the formatted JSON for each course that has been scraped.
	- It should be named in respect to the course_id parameter which we will keep universal (eg. CSC108H1F20149.json)
	- It should fill as much of the course schema as it can
```js
{
	course_id: String,
	code: String,
	name: String,
	description: String,
	division: String,
	prerequisites: String,
	exlusions: String,
	course_level: Number,
	breadths: [Number],
	campus: String,
	term: String,
	apsc_elec: String,
	meeting_sections: [{
		code: String,
		instructors: [String],
		times: [{
			day: String,
			start: String,
			end: String,
			location: String
		}],
		class_size: Number,
		class_enrolment: Number
	}]
}
```

Web API
----------
For any parameter:
 - “**,**” indicates **AND** (eg. breadth=1,2)
 - “**/**” indicates **OR** (eg. instructor=Heap/Liu)
 - “**-**” indicates **NOT** (eg. department=-architecture)

For any numerical or time parameter:
 - "**>**" indicates **GREATER THAN** (eg. class_size=>30)
 - "**<**" indicates **LESS THAN** (eg. start_time=<18:00)
 - "**.>**" indicates **GREATER THAN OR EQUAL TO** (eg. class_enrolment=.>1)
 - "**.<**" indicates **LESS THAN OR EQUAL TO** (eg. course_level=.<200)
 - No operator indicates **EQUAL TO** (eg. breadth=5)

For any string parameter:
 - No operator indicates **CONTAINS** (eg. code=CSC)

**AND** and **OR** can be combined, with **AND** taking precedence. The **NOT** operator and any numerical operator only affects its immediate segment (eg. -Heap/Liu implies [**NOT** Heap] **OR** Liu).

|Parameter|Description|Type|Example|
|---|---|---|---|---|
|course_id|The unique identifier for directly referring to a course.|String|CSC148H1F20149|
|code|The 9 character code for representing a course.|String|CSC148H1F|
|name|The formal name of a course.|String|Introduction to Computer Science|
|description|The formal description of a course.|String|...|
|division|The faculty which a course is under.|String|Faculty of Arts and Science|
|prerequisites|List of courses that are required in order to take the current course.|String|CSC108H1|
|exclusions|List of courses you may not take concurrently with the current course.|String|CSC150H1|
|course_level|Level the course belongs to.|Integer|100|
|breadths|The breadths that a course involves.|Integer Array|[5]|
|campus|The campus that a course is under.|String|UTSG|
|term|The semester that the course is under.|String|2014 Fall|
