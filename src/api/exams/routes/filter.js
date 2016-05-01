import Athletics from '../model'
import co from 'co'
import mapReduce from './filterMapReduce'

// TODO add filters for sections.exam_section

const KEYMAP = {
  id: 'course_id',
  code: 'course_code',
  campus: 'campus',
  period: 'period',
  date: 'date_num',
  start: 'start_time',
  duration: 'duration',
  end: 'end_time',
  lecture: 'lecture_code',
  location: 'location'
}

const ABSOLUTE_KEYMAP = {
  id: 'course_id',
  code: 'course_code',
  campus: 'campus',
  period: 'period',
  date: 'date_num',
  start: 'start_time',
  end: 'end_time',
  duration: 'duration',
  lecture: 'sections.lecture_code',
  location: 'sections.location'
}

export default function filter(req, res, next) {
  let q = req.query.q
  q = q.split(' AND ')

  let queries = 0
  let isMapReduce = false
  let mapReduceData = []

  let filter = { $and: q }

  for (let i = 0; i < filter.$and.length; i++) {
    filter.$and[i] = { $or: q[i].trim().split(' OR ') }
    let mapReduceOr = []
    for (let j = 0; j < filter.$and[i].$or.length; j++) {
      let query = filter.$and[i].$or[j].trim()
      let part = [query.slice(0, query.indexOf(':')), query.slice(query.indexOf(':') + 1)]

      let x = formatPart(part[0], part[1])

      if (x.isValid) {
        if (x.isMapReduce) {
          isMapReduce = true
          x.mapReduceData.key = KEYMAP[x.key]
          mapReduceOr.push(x.mapReduceData)
        }

        filter.$and[i].$or[j] = x.query
        queries++
      } else if (x.error) {
        return next(x.error)
      }

      if (mapReduceOr.length > 0) {
        mapReduceData.push(mapReduceOr)
      }
    }
  }
  if(queries > 0) {
    if(isMapReduce) {
      var o = {
        query: filter,
        scope: {
          data: mapReduceData
        },
        limit: req.query.limit,
        map: mapReduce.map,
        reduce: mapReduce.reduce
      }

      co(function* () {
        try {
          let docs = yield Athletics.mapReduce(o)

          let formattedDocs = []
          for (let doc of docs) {
            formattedDocs.push(doc.value)
          }
          res.json(formattedDocs)
        } catch(e) {
          return next(e)
        }
      })
    } else {
      co(function* () {
        try {
          let docs = yield Athletics
            .find(filter, '-__v -_id -sections._id -date_num')
            .limit(req.query.limit)
            .skip(req.query.skip)
            .sort(req.query.sort)
            .exec()
          res.json(docs)
        } catch(e) {
          return next(e)
        }
      })
    }
  }
}

function formatPart(key, part) {
  // Response format
  let response = {
    key: key,
    error: null,
    isValid: true,
    isMapReduce: false,
    mapReduceData: {},
    query: {}
  }

  // Checking if the start of the segment is an operator (-, >, <, .>, .<)

  if (part.indexOf('-') === 0) {
    // Negation
    part = {
      operator: '-',
      value: part.substring(1)
    }
  } else if (part.indexOf('>=') === 0) {
    part = {
      operator: '>=',
      value: part.substring(2)
    }
  } else if (part.indexOf('<=') === 0) {
    part = {
      operator: '<=',
      value: part.substring(2)
    }
  } else if (part.indexOf('>') === 0) {
    part = {
      operator: '>',
      value: part.substring(1)
    }
  } else if (part.indexOf('<') === 0) {
    part = {
      operator: '<',
      value: part.substring(1)
    }
  } else {
    part = {
      operator: undefined,
      value: part
    }
  }

  if (isNaN(parseFloat(part.value)) || !isFinite(part.value)) {
    // Is not a number
    part.value = part.value.substring(1, part.value.length - 1)
  } else {
    part.value = parseFloat(part.value)
  }


  if (['date', 'start', 'end', 'duration'].indexOf(key) > -1) {
    // Dates, times, numbers

    if (key === 'date') {
      let date = undefined
      let dateValue = String(part.value).split('-')

      if (dateValue.length === 3) {
        date = parseInt(dateValue.join(''))
      }

      if (!date || isNaN(date) || isNaN(new Date(part.value))) {
        response.isValid = false
        response.error = new Error('Invalid date parameter.')
        response.error.status = 400
        return response
      }
      part.value = date
    } else {
      // Times
      let validTime = true

      if (typeof part.value !== 'number' && part.value.indexOf(':') > -1) {
        // TODO add period support (AM/PM)
        // Time formatted as 'HH:MM:SS' or 'HH:MM'
        let timeValue = part.value.split(':')
        let time = 0

        for (let i = 0; i < Math.min(timeValue.length, 3); i++) {
          if (isNaN(parseInt(timeValue[i]))) {
            validTime = false
            break
          }

          time += parseInt(timeValue[i]) * Math.pow(60, 2 - i)
        }

        part.value = time

      } else if (typeof part.value !== 'number') {
        validTime = false
      }

      if (!validTime || part.value > 86400) {
        response.isValid = false
        response.error = new Error('Invalid time parameter.')
        response.error.status = 400
        return response
      }
    }

    if (part.operator === '-') {
      response.query[ABSOLUTE_KEYMAP[key]] = { $ne: part.value }
    } else if (part.operator === '>') {
      response.query[ABSOLUTE_KEYMAP[key]] = { $gt: part.value }
    } else if (part.operator === '<') {
      response.query[ABSOLUTE_KEYMAP[key]] = { $lt: part.value }
    } else if (part.operator === '>=') {
      response.query[ABSOLUTE_KEYMAP[key]] = { $gte: part.value }
    } else if (part.operator === '<=') {
      response.query[ABSOLUTE_KEYMAP[key]] = { $lte: part.value }
    } else {
      // Assume equality if no operator
      response.query[ABSOLUTE_KEYMAP[key]] = part.value
    }
  } else {
    // Strings
    if (['lecture', 'section', 'location'].indexOf(key) > -1) {
      response.isMapReduce = true
      response.mapReduceData = part
    }

    if (part.operator === '-') {
      response.query[ABSOLUTE_KEYMAP[key]] = {
        $regex: '^((?!' + escapeRe(part.value) + ').)*$',
        $options: 'i'
      }
    } else {
      response.query[ABSOLUTE_KEYMAP[key]] = { $regex: '(?i).*' + escapeRe(part.value) + '.*' }
    }
  }
  return response
}

function escapeRe(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
}