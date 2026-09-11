const fs = require('fs');

const frame = {
  step: 2,
  line: 6,
  stack: [
    {
      name: "main",
      locals: {
        temp: { type: "primitive", value: 64 },
        arr: { type: "reference", pointsTo: "ref:48" }
      }
    }
  ],
  heap: {
    "ref:48": {
      type: "array",
      value: [
        { type: "primitive", value: 64 },
        { type: "primitive", value: 34 }
      ]
    }
  }
};

const topFrame = frame.stack[0];
const rawVars = topFrame?.locals || topFrame?.localVars || {};
const result = {};
for (const [k, v] of Object.entries(rawVars)) {
  if (v && typeof v === 'object' && v.type) {
    if (v.type === 'primitive') result[k] = v.value;
    else if (v.type === 'reference') result[k] = 'ref:' + v.pointsTo;
  } else {
    result[k] = v;
  }
}
console.log("vars:", result);

let arrayVals = [];
for (const key in frame.heap) {
  if (frame.heap[key].type === 'array' || Array.isArray(frame.heap[key].value)) {
    arrayVals = frame.heap[key].value || [];
    break;
  }
}

const normalizeArray = (rawArr) => rawArr.map(v => v && typeof v === 'object' && v.type === 'primitive' ? v.value : v && typeof v === 'object' && v.type === 'reference' ? v.pointsTo : v);
arrayVals = normalizeArray(arrayVals);
console.log("arrayVals:", arrayVals);
