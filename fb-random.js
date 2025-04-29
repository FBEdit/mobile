const WIDTH = 800, HEIGHT = 600, FPS = 60;
const COLORS = {
  BLACK: "#000", WHITE: "#fff", RED: "#f00", GREEN: "#0f0", BLUE: "#00f",
  YELLOW: "#ff0", PURPLE: "#800080"
};
const MENU = 0, PLAYING = 1, GAME_OVER = 2, LEADERBOARD = 3, REPLAY = 4, SETTINGS = 5;
let gameState = MENU, aspectMode = "stretched", joyType = "joystick", btnSide = "right";
let joySize = 18, btnSize = 12, padSize = 18;
let player = {x:50, y:HEIGHT/2, w:40, h:40}, goal = {x:WIDTH-100, y:HEIGHT-100, w:50, h:50};
let keyObj = randRect(30,30), door = {x:WIDTH/2-25, y:HEIGHT/2-50, w:50, h:100};
let obstacles = Array.from({length:5},()=>randRect(60,60));
let speed = 5, timerStarted = false, startTime = 0, endTime = 0, hasKey = false;
let level = 1, maxLevel = 3, replayData = [], pbData = {top_10:[]}, currentReplay = null, replayFrame = 0, replayPaused = true;
let joyActive = false, joyDX = 0, joyDY = 0, joyTouchId = null;
let padBtns = {}, padActiveBtn = null;
const container = document.createElement("div");
container.id = "container";
document.body.appendChild(container);
const canvas = document.createElement("canvas");
canvas.id = "game";
container.appendChild(canvas);
const ctx = canvas.getContext("2d");
const joy = document.createElement("div");
joy.id = "joystick";
joy.innerHTML = '<div id="stick"></div>';
document.body.appendChild(joy);
const stick = document.getElementById("stick");
const pad = document.createElement("div");
pad.id = "pad";
["","","↑","","","↓","←","","→"].forEach((txt,i)=>{
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pad-btn";
  btn.setAttribute("tabindex","-1");
  btn.dataset.dir = ["","","up","","","down","left","","right"][i]||"";
  btn.textContent = txt;
  btn.style.visibility = txt ? "" : "hidden";
  pad.appendChild(btn);
  if(txt) padBtns[btn.dataset.dir] = btn;
});
document.body.appendChild(pad);
const escBtn = document.createElement("button");
escBtn.id = "escBtn"; escBtn.innerText = "Menu";
document.body.appendChild(escBtn);
const rBtn = document.createElement("button");
rBtn.id = "rBtn"; rBtn.innerText = "Restart";
document.body.appendChild(rBtn);
canvas.width = WIDTH; canvas.height = HEIGHT;
function randRect(w,h) {
  return {x:100+Math.random()*(WIDTH-200), y:100+Math.random()*(HEIGHT-200), w, h};
}
function drawRect(r, color) {
  ctx.fillStyle = color; ctx.fillRect(r.x, r.y, r.w, r.h);
}
function drawText(txt, x, y, size=36, color="#fff", align="center") {
  ctx.font = `bold ${size}px sans-serif`; ctx.fillStyle = color;
  ctx.textAlign = align; ctx.fillText(txt, x, y);
}
function drawBtn(x,y,w,h,color,txt) {
  ctx.fillStyle=color; ctx.fillRect(x,y,w,h);
  drawText(txt, x+w/2, y+h/2+6, 28, COLORS.BLACK);
}
function collide(a,b) {
  return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
}
function resetLevel() {
  player = {x:50, y:HEIGHT/2, w:40, h:40};
  keyObj = randRect(30,30);
  door = {x:WIDTH/2-25, y:HEIGHT/2-50, w:50, h:100};
  obstacles = Array.from({length:5},()=>randRect(60,60));
  hasKey = false;
  timerStarted = false;
  startTime = 0;
  replayData = [];
}
function restartGame() {
  level = 1;
  resetLevel();
  player.x = 50; player.y = HEIGHT/2;
  gameState = PLAYING;
}
function saveRun() {
  let run_time = endTime - startTime;
  let serialized = replayData.map(frame=>({
    player:{...frame.player}, key:{...frame.key}, door:{...frame.door},
    obstacles:frame.obstacles.map(o=>({...o})), has_key:frame.has_key
  }));
  let encoded = btoa(unescape(encodeURIComponent(JSON.stringify(serialized))));
  let run_entry = {time:run_time, replay:encoded};
  pbData.top_10.push(run_entry);
  pbData.top_10 = pbData.top_10.sort((a,b)=>a.time-b.time).slice(0,10);
  localStorage.setItem("fb_pb",JSON.stringify(pbData));
}
function loadPbData() {
  let d = localStorage.getItem("fb_pb");
  if (d) try { pbData = JSON.parse(d); } catch {}
}
function startReplay(replay) {
  currentReplay = JSON.parse(decodeURIComponent(escape(atob(replay))));
  replayFrame = 0;
  replayPaused = false;
  gameState = REPLAY;
}
function drawMenu() {
  ctx.fillStyle=COLORS.BLACK; ctx.fillRect(0,0,WIDTH,HEIGHT);
  drawText("FURRY BALLS", WIDTH/2, HEIGHT/4, 48, COLORS.WHITE);
  drawBtn(WIDTH/2-100, HEIGHT/2-50, 200, 50, COLORS.GREEN, "PLAY");
  drawBtn(WIDTH/2-100, HEIGHT/2+20, 200, 50, COLORS.BLUE, "LEADERBOARD");
  drawBtn(WIDTH/2-100, HEIGHT/2+90, 200, 50, COLORS.YELLOW, "SETTINGS");
}
function drawSettings() {
  ctx.fillStyle=COLORS.BLACK; ctx.fillRect(0,0,WIDTH,HEIGHT);
  drawText("SETTINGS", WIDTH/2, HEIGHT/4, 48, COLORS.WHITE);
  drawBtn(WIDTH/2-100, HEIGHT/2-90, 200, 50, aspectMode=="stretched"?COLORS.GREEN:COLORS.BLUE, "ASPECT: "+(aspectMode=="stretched"?"STRETCHED":"4:3"));
  drawBtn(WIDTH/2-100, HEIGHT/2-25, 200, 50, joyType=="joystick"?COLORS.GREEN:COLORS.BLUE, "CONTROL: "+(joyType=="joystick"?"JOYSTICK":"PAD"));
  drawBtn(WIDTH/2-100, HEIGHT/2+40, 200, 50, btnSide=="right"?COLORS.GREEN:COLORS.BLUE, "BUTTONS: "+(btnSide=="right"?"RIGHT":"LEFT"));
  drawBtn(WIDTH/2-100, HEIGHT/2+105, 95, 50, COLORS.PURPLE, "-");
  drawText("JSZ", WIDTH/2, HEIGHT/2+135, 20, COLORS.WHITE);
  drawBtn(WIDTH/2+5, HEIGHT/2+105, 95, 50, COLORS.PURPLE, "+");
  drawBtn(WIDTH/2-100, HEIGHT/2+170, 95, 50, COLORS.YELLOW, "-");
  drawText("BTN", WIDTH/2, HEIGHT/2+200, 20, COLORS.WHITE);
  drawBtn(WIDTH/2+5, HEIGHT/2+170, 95, 50, COLORS.YELLOW, "+");
  drawBtn(WIDTH/2-100, HEIGHT/2+235, 200, 50, COLORS.BLUE, "BACK");
}
function drawLeaderboard() {
  ctx.fillStyle=COLORS.BLACK; ctx.fillRect(0,0,WIDTH,HEIGHT);
  drawText("LEADERBOARD", WIDTH/2, 50, 40, COLORS.WHITE);
  drawBtn(50, 50, 100, 40, COLORS.RED, "BACK");
  let y = 120;
  for (let i=0;i<pbData.top_10.length;i++) {
    let run = pbData.top_10[i];
    drawText(`${i+1}. ${run.time.toFixed(2)}s`, WIDTH/2-150, y+25, 28, COLORS.WHITE, "left");
    drawBtn(WIDTH/2+50, y, 100, 30, COLORS.PURPLE, "REPLAY");
    y+=40;
  }
}
function drawGameOver() {
  ctx.fillStyle=COLORS.BLACK; ctx.fillRect(0,0,WIDTH,HEIGHT);
  drawText("GAME OVER", WIDTH/2, HEIGHT/4, 48, COLORS.WHITE);
  drawText(`Your Time: ${(endTime-startTime).toFixed(2)}s`, WIDTH/2, HEIGHT/4+50, 32, COLORS.WHITE);
  drawBtn(WIDTH/2-100, HEIGHT/2, 200, 50, COLORS.BLUE, "MENU");
  drawBtn(WIDTH/2-100, HEIGHT/2+70, 200, 50, COLORS.GREEN, "LEADERBOARD");
}
function drawGame() {
  drawRect(player,COLORS.GREEN);
  drawRect(goal,COLORS.RED);
  if (!hasKey) drawRect(keyObj,COLORS.YELLOW);
  drawRect(door,COLORS.BLUE);
  for (let o of obstacles) drawRect(o,COLORS.WHITE);
  if (timerStarted) drawText(`Time: ${(Date.now()/1000-startTime).toFixed(2)}s`, 20, 40, 28, COLORS.WHITE, "left");
  drawText(`Level: ${level}`, 20, 80, 28, COLORS.WHITE, "left");
}
function drawReplay() {
  if (currentReplay && replayFrame < currentReplay.length) {
    let frame = currentReplay[replayFrame];
    player = {...frame.player};
    keyObj = {...frame.key};
    door = {...frame.door};
    obstacles = frame.obstacles.map(o=>({...o}));
    hasKey = frame.has_key;
    drawGame();
    replayFrame += replayPaused?0:1;
  } else {
    gameState = LEADERBOARD;
  }
  drawBtn(50, 50, 100, 40, COLORS.RED, "BACK");
  drawBtn(WIDTH/2-60, HEIGHT-80, 120, 50, replayPaused?COLORS.GREEN:COLORS.YELLOW, replayPaused?"▶":"⏸");
}
function handleCollisions() {
  for (let o of obstacles) if (collide(player,o)) { player.x=50; player.y=HEIGHT/2; }
  if (collide(player,keyObj)) { hasKey=true; keyObj.x=-100; keyObj.y=-100; }
  if (collide(player,door)&&hasKey) { door.x=-100; door.y=-100; }
  if (collide(player,goal)) {
    if (level<maxLevel) {
      level++;
      keyObj = randRect(30,30);
      door = {x:WIDTH/2-25, y:HEIGHT/2-50, w:50, h:100};
      obstacles = Array.from({length:5},()=>randRect(60,60));
      hasKey = false;
      player.x=50; player.y=HEIGHT/2;
    } else {
      endTime = Date.now()/1000;
      saveRun();
      player.x=50; player.y=HEIGHT/2;
      gameState = GAME_OVER;
    }
  }
  if (player.x<0||player.y<0||player.x>WIDTH-player.w||player.y>HEIGHT-player.h)
    { player.x=50; player.y=HEIGHT/2; }
  if (Math.random()<0.01)
    obstacles.push(randRect(60,60));
}
function handleInput() {
  let dx=0,dy=0;
  if (joyType=="joystick"&&joyActive) { dx=joyDX*speed; dy=joyDY*speed; }
  if (joyType=="pad"&&padActiveBtn) {
    if (padActiveBtn=="left") dx=-speed;
    if (padActiveBtn=="right") dx=speed;
    if (padActiveBtn=="up") dy=-speed;
    if (padActiveBtn=="down") dy=speed;
  }
  player.x+=dx; player.y+=dy;
  if ((dx||dy)&&!timerStarted) { timerStarted=true; startTime=Date.now()/1000; }
}
function recordFrame() {
  replayData.push({
    player:{...player}, key:{...keyObj}, door:{...door},
    obstacles:obstacles.map(o=>({...o})), has_key:hasKey
  });
}
function gameLoop() {
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  if (gameState==MENU) drawMenu();
  else if (gameState==PLAYING) {
    handleInput(); handleCollisions(); recordFrame(); drawGame();
  }
  else if (gameState==GAME_OVER) drawGameOver();
  else if (gameState==LEADERBOARD) drawLeaderboard();
  else if (gameState==REPLAY) drawReplay();
  else if (gameState==SETTINGS) drawSettings();
  requestAnimationFrame(gameLoop);
}
function handleResize() {
  let ar = window.innerWidth/window.innerHeight;
  if (aspectMode=="4:3") {
    document.body.classList.add("aspect-4-3");
    let targetW = window.innerWidth, targetH = window.innerHeight;
    if (ar > 4/3) {
      targetH = window.innerHeight;
      targetW = targetH*4/3;
    } else {
      targetW = window.innerWidth;
      targetH = targetW*3/4;
    }
    canvas.style.width = targetW+"px";
    canvas.style.height = targetH+"px";
    container.style.justifyContent = "center";
    container.style.alignItems = "center";
  } else {
    document.body.classList.remove("aspect-4-3");
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    container.style.justifyContent = "center";
    container.style.alignItems = "center";
  }
  let vmin = Math.min(window.innerWidth,window.innerHeight);
  joy.style.setProperty('--joy-size',`${joySize}vw`);
  joy.style.setProperty('--thumb-size',`${Math.round(joySize*0.35)}vw`);
  pad.style.setProperty('--pad-size',`${padSize}vw`);
  escBtn.style.setProperty('--btn-width',`${btnSize}vw`);
  escBtn.style.setProperty('--btn-height',`${btnSize*0.65}vw`);
  rBtn.style.setProperty('--btn-width',`${btnSize}vw`);
  rBtn.style.setProperty('--btn-height',`${btnSize*0.65}vw`);
  if(btnSide=="right") {
    escBtn.style.setProperty('--btn-right',"2vw");
    escBtn.style.setProperty('--btn-left',"auto");
    rBtn.style.setProperty('--btn-right',"2vw");
    rBtn.style.setProperty('--btn-left',"auto");
    document.body.classList.remove("btn-left");
  } else {
    escBtn.style.setProperty('--btn-right',"auto");
    escBtn.style.setProperty('--btn-left',"2vw");
    rBtn.style.setProperty('--btn-right',"auto");
    rBtn.style.setProperty('--btn-left',"2vw");
    document.body.classList.add("btn-left");
  }
  joy.style.setProperty('--joy-left',btnSide=="right"?"2vw":"auto");
  pad.style.setProperty('--joy-left',btnSide=="right"?"2vw":"auto");
}
window.addEventListener("resize", handleResize);
handleResize();
canvas.addEventListener("touchstart", e=>{ handleTouch(e); });
canvas.addEventListener("touchmove", e=>{ handleTouch(e); });
canvas.addEventListener("touchend", e=>{ handleTouch(e,true); });
canvas.addEventListener("mousedown", e=>{ handleTouchMouse(e); });
canvas.addEventListener("mouseup", e=>{ handleTouchMouse(e,true); });
function handleTouch(e, end) {
  let t = e.touches[0]||e.changedTouches[0];
  let rect = canvas.getBoundingClientRect();
  let x = (t.clientX-rect.left)*WIDTH/rect.width, y = (t.clientY-rect.top)*HEIGHT/rect.height;
  handleClick(x,y);
  e.preventDefault();
}
function handleTouchMouse(e, end) {
  let rect = canvas.getBoundingClientRect();
  let x = (e.clientX-rect.left)*WIDTH/rect.width, y = (e.clientY-rect.top)*HEIGHT/rect.height;
  handleClick(x,y);
}
function handleClick(x,y) {
  if (gameState==MENU) {
    if (inRect(x,y,WIDTH/2-100,HEIGHT/2-50,200,50)) { restartGame(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+20,200,50)) { gameState=LEADERBOARD; }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+90,200,50)) { gameState=SETTINGS; }
  } else if (gameState==SETTINGS) {
    if (inRect(x,y,WIDTH/2-100,HEIGHT/2-90,200,50)) { aspectMode = aspectMode=="stretched"?"4:3":"stretched"; handleResize(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2-25,200,50)) { joyType = joyType=="joystick"?"pad":"joystick"; updateControls(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+40,200,50)) { btnSide = btnSide=="right"?"left":"right"; handleResize(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+105,95,50)) { joySize = Math.max(10, joySize-2); padSize = Math.max(10, padSize-2); handleResize(); }
    else if (inRect(x,y,WIDTH/2+5,HEIGHT/2+105,95,50)) { joySize = Math.min(30, joySize+2); padSize = Math.min(30, padSize+2); handleResize(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+170,95,50)) { btnSize = Math.max(8, btnSize-2); handleResize(); }
    else if (inRect(x,y,WIDTH/2+5,HEIGHT/2+170,95,50)) { btnSize = Math.min(20, btnSize+2); handleResize(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+235,200,50)) { gameState=MENU; }
  } else if (gameState==GAME_OVER) {
    if (inRect(x,y,WIDTH/2-100,HEIGHT/2,200,50)) { gameState=MENU; }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+70,200,50)) { gameState=LEADERBOARD; }
  } else if (gameState==LEADERBOARD) {
    if (inRect(x,y,50,50,100,40)) { gameState=MENU; }
    let yBtn = 120;
    for (let i=0;i<pbData.top_10.length;i++) {
      if (inRect(x,y,WIDTH/2+50,yBtn,100,30)) { startReplay(pbData.top_10[i].replay); }
      yBtn+=40;
    }
  } else if (gameState==REPLAY) {
    if (inRect(x,y,50,50,100,40)) { gameState=LEADERBOARD; }
    if (inRect(x,y,WIDTH/2-60,HEIGHT-80,120,50)) { replayPaused=!replayPaused; }
  }
}
function inRect(x,y,rx,ry,rw,rh) { return x>=rx&&x<=rx+rw&&y>=ry&&y<=ry+rh; }
function updateControls() {
  joy.style.display = joyType=="joystick"?"flex":"none";
  pad.style.display = joyType=="pad"?"grid":"none";
}
joy.addEventListener("touchstart", joyTouch, {passive:false});
joy.addEventListener("touchmove", joyTouch, {passive:false});
joy.addEventListener("touchend", joyEnd, {passive:false});
function joyTouch(e) {
  if(joyType!="joystick")return;
  let t = null;
  for (let i=0;i<e.touches.length;i++) {
    if (!joyTouchId || e.touches[i].identifier===joyTouchId) { t = e.touches[i]; joyTouchId = e.touches[i].identifier; break; }
  }
  if (!t) return;
  let rect = joy.getBoundingClientRect();
  let x = t.clientX-rect.left-rect.width/2, y = t.clientY-rect.top-rect.height/2;
  let max = rect.width/2-rect.width*0.18;
  let dist = Math.sqrt(x*x+y*y);
  if (dist>max) { x=x*max/dist; y=y*max/dist; }
  let percX = 50 + (x/max)*42, percY = 50 + (y/max)*42;
  stick.style.left = percX+"%";
  stick.style.top = percY+"%";
  joyActive=true;
  joyDX = x/max; joyDY = y/max;
  e.preventDefault();
}
function joyEnd(e) {
  if(joyType!="joystick")return;
  joyActive=false; joyDX=0; joyDY=0; joyTouchId=null;
  stick.style.left="50%"; stick.style.top="50%";
}
function preventSelect(e) { e.preventDefault(); }
Object.values(padBtns).forEach(btn=>{
  btn.addEventListener("touchstart",e=>{
    if(joyType!="pad")return;
    padActiveBtn=btn.dataset.dir;
    Object.values(padBtns).forEach(b=>b.classList.toggle("pressed",b===btn));
    e.preventDefault();
  },{passive:false});
  btn.addEventListener("touchenter",e=>{
    if(joyType!="pad")return;
    padActiveBtn=btn.dataset.dir;
    Object.values(padBtns).forEach(b=>b.classList.toggle("pressed",b===btn));
    e.preventDefault();
  },{passive:false});
  btn.addEventListener("touchmove",e=>{
    if(joyType!="pad")return;
    let touch=e.touches[0];
    let found=null;
    Object.values(padBtns).forEach(b=>{
      let r=b.getBoundingClientRect();
      if(touch.clientX>=r.left&&touch.clientX<=r.right&&touch.clientY>=r.top&&touch.clientY<=r.bottom)found=b;
    });
    if(found&&padActiveBtn!==found.dataset.dir){
      padActiveBtn=found.dataset.dir;
      Object.values(padBtns).forEach(b=>b.classList.toggle("pressed",b===found));
    }
    e.preventDefault();
  },{passive:false});
  btn.addEventListener("touchend",e=>{
    if(joyType!="pad")return;
    padActiveBtn=null;
    Object.values(padBtns).forEach(b=>b.classList.remove("pressed"));
    e.preventDefault();
  },{passive:false});
  btn.addEventListener("mousedown",e=>{
    if(joyType!="pad")return;
    padActiveBtn=btn.dataset.dir;
    Object.values(padBtns).forEach(b=>b.classList.toggle("pressed",b===btn));
    e.preventDefault();
  });
  btn.addEventListener("mouseenter",e=>{
    if(e.buttons&&joyType=="pad"){
      padActiveBtn=btn.dataset.dir;
      Object.values(padBtns).forEach(b=>b.classList.toggle("pressed",b===btn));
    }
    e.preventDefault();
  });
  btn.addEventListener("mouseleave",e=>{
    if(joyType!="pad")return;
    padActiveBtn=null;
    Object.values(padBtns).forEach(b=>b.classList.remove("pressed"));
    e.preventDefault();
  });
  btn.addEventListener("mouseup",e=>{
    if(joyType!="pad")return;
    padActiveBtn=null;
    Object.values(padBtns).forEach(b=>b.classList.remove("pressed"));
    e.preventDefault();
  });
  btn.addEventListener("selectstart",preventSelect);
});
updateControls();
escBtn.addEventListener("touchstart",()=>{ if(gameState==PLAYING)gameState=MENU; });
escBtn.addEventListener("click",()=>{ if(gameState==PLAYING)gameState=MENU; });
rBtn.addEventListener("touchstart",()=>{ if(gameState==PLAYING)restartGame(); });
rBtn.addEventListener("click",()=>{ if(gameState==PLAYING)restartGame(); });
loadPbData();
requestAnimationFrame(gameLoop);