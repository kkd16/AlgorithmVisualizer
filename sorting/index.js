// index.js
let data = [];
let running = false;
let paused = false;
let comparisons = 0, swaps = 0, writes = 0;

const svg = d3.select("#chart");
const margin = { top: 20, right: 20, bottom: 30, left: 20 };
const height = () => svg.node().clientHeight - margin.top - margin.bottom;
const width  = () => svg.node().clientWidth  - margin.left - margin.right;
const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const $generate = document.getElementById("generate");
const $run = document.getElementById("run");
const $pause = document.getElementById("pause");
const $stop = document.getElementById("stop");
const $size = document.getElementById("size");
const $speed = document.getElementById("speed");
const $algo = document.getElementById("algo");

function resetStats(){
    comparisons = swaps = writes = 0;
    d3.select("#comparisons").text(0);
    d3.select("#swaps").text(0); 
    d3.select("#writes").text(0); 
}

function updateStats(){
    d3.select("#comparisons").text(comparisons);
    d3.select("#swaps").text(swaps);
    d3.select("#writes").text(writes);
}

// UI
function updateUI(){
  $generate.disabled = running || paused;
  $run.disabled = running;
  $pause.disabled = !running;
  $pause.textContent = paused ? "Resume" : "Pause";
  $stop.disabled = !(running || paused);
  $size.disabled = running || paused;
  $algo.disabled = running || paused;
}

function genData(n){
  data = d3.shuffle(d3.range(1, n+1).map(d => Math.round(d3.randomUniform(5,100)())));
  resetStats();
  draw();
}

function safeGenerate(){
  if (running || paused) return;
  genData(+$size.value);
}

function draw(highlight = []) {
  const w = width(), h = height();
  svg.attr("viewBox", `0 0 ${w + margin.left + margin.right} ${h + margin.top + margin.bottom}`);
  const x = d3.scaleBand().domain(d3.range(data.length)).range([0,w]).paddingInner(0.1);
  const y = d3.scaleLinear().domain([0, d3.max(data) || 1]).range([0,h]);

  const bars = g.selectAll("rect").data(data, (_,i)=>i);
  bars.join(
    enter => enter.append("rect")
      .attr("class","bar")
      .attr("x",(d,i)=>x(i))
      .attr("y", d=>h - y(d))
      .attr("width", x.bandwidth())
      .attr("height", d=>y(d))
      .attr("fill", (d,i)=> highlight.includes(i) ? "#f59e0b" : "#38bdf8"),
    update => update
      .attr("x",(d,i)=>x(i))
      .attr("y", d=>h - y(d))
      .attr("width", x.bandwidth())
      .attr("height", d=>y(d))
      .attr("fill", (d,i)=> highlight.includes(i) ? "#f59e0b" : "#38bdf8")
  );
}

// Algorithms
function* bubbleSort(arr) {
  const a = arr.slice();
  const n = a.length;
  for (let i=0;i<n;i++){
    for (let j=0;j<n-i-1;j++){
      comparisons++;
      yield {a:a.slice(), highlight:[j,j+1], comparisons, swaps};
      if (a[j] > a[j+1]) {
        [a[j], a[j+1]] = [a[j+1], a[j]];
        swaps++;
        yield {a:a.slice(), highlight:[j,j+1], comparisons, swaps};
      }
    }
  }
  return {a, highlight:[]};
}

function* insertionSort(arr){
  const a = arr.slice();
  for (let i=1;i<a.length;i++){
    let key = a[i], j = i-1;
    while (j>=0 && (comparisons++, a[j] > key)){
      a[j+1] = a[j]; j--; swaps++;
      yield {a:a.slice(), highlight:[j,j+1], comparisons, swaps};
    }
    a[j+1] = key;
    yield {a:a.slice(), highlight:[j+1], comparisons, swaps};
  }
  return {a, highlight:[]};
}

function* mergeSort(arr){
  const a = arr.slice();

  function* mergeSortRec(l, r){
    if (r - l <= 1) return;

    const m = Math.floor((l + r) / 2);
    yield* mergeSortRec(l, m);
    yield* mergeSortRec(m, r);

    const left = a.slice(l, m);
    const right = a.slice(m, r);
    let i = 0, j = 0, k = l;

    while (i < left.length && j < right.length){
      comparisons++;
      if (left[i] <= right[j]) {
        a[k++] = left[i++];
        writes++;
      } else {
        a[k++] = right[j++];
        writes++;
      }
      yield { a: a.slice(), highlight: [k-1], comparisons, swaps };
    }

    while (i < left.length){
      a[k++] = left[i++];
      writes++;
      yield { a: a.slice(), highlight: [k-1], comparisons, swaps };
    }
    while (j < right.length){
      a[k++] = right[j++];
      writes++;
      yield { a: a.slice(), highlight: [k-1], comparisons, swaps };
    }
  }

  yield* mergeSortRec(0, a.length);
  return { a, highlight: [] };
}

const algos = { bubble: bubbleSort, insertion: insertionSort, merge: mergeSort };

// Runner
let currentIter = null;

async function run(){
  if (running) return;
  running = true;
  paused = false;
  resetStats();
  updateUI();

  $run.textContent = "Running…";

  const algo = $algo.value;
  currentIter = algos[algo](data);

  while (running){
    if (paused){ await wait(50); continue; }
    const speed = +$speed.value;
    const delay = 500 - speed*5;
    const next = currentIter.next();
    if (next.done){
      data = next.value?.a ?? data;
      draw([]);
      break;
    } else {
      const {a, highlight} = next.value;
      data = a;
      draw(highlight);
      updateStats();
      await wait(delay);
    }
  }

  running = false;
  paused = false;
  currentIter = null;
  $run.textContent = "Run";
  draw([]);
  updateUI();
}

function wait(ms){ return new Promise(res=>setTimeout(res,ms)); }

// UI
$generate.onclick = safeGenerate;
$run.onclick = run;

$pause.onclick = () => {
  if (!running) return;
  paused = !paused;
  updateUI();
};

$stop.onclick = () => {
  if (!(running || paused)) return;
  running = false;
  paused = false;
  currentIter = null;
  draw([]);
  updateUI();
};

$size.oninput = (e)=> {
  if (running || paused) return;
  genData(+e.target.value);
};

window.addEventListener("resize", ()=> draw());

// init
genData(20);
updateUI();
