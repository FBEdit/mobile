const WIDTH = 800, HEIGHT = 600, FPS = 60;
const COLORS = {
  BLACK: "#000", WHITE: "#fff", RED: "#f00", GREEN: "#0f0", BLUE: "#00f",
  YELLOW: "#ff0", PURPLE: "#800080"
};
const MENU = 0, PLAYING = 1, GAME_OVER = 2, LEADERBOARD = 3, REPLAY = 4, SETTINGS = 5;
let gameState = MENU, fullscreen = false;
let player = {x:50, y:HEIGHT/2, w:40, h:40}, goal = {x:WIDTH-100, y:HEIGHT-100, w:50, h:50};
let keyObj = randRect(30,30), door = {x:WIDTH/2-25, y:HEIGHT/2-50, w:50, h:100};
let obstacles = Array.from({length:5},()=>randRect(60,60));
let speed = 5, timerStarted = false, startTime = 0, endTime = 0, hasKey = false;
let level = 1, maxLevel = 3, replayData = [], pbData = {top_10:[]}, currentReplay = null, replayFrame = 0, replayPaused = true;
let joyActive = false, joyDX = 0, joyDY = 0, joyTouchId = null;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
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
  drawBtn(WIDTH/2-100, HEIGHT/2-25, 200, 50, fullscreen?COLORS.GREEN:COLORS.RED, "FULLSCREEN");
  drawBtn(WIDTH/2-100, HEIGHT/2+50, 200, 50, COLORS.BLUE, "BACK");
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
  if (joyActive) { dx=joyDX*speed; dy=joyDY*speed; }
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
    if (inRect(x,y,WIDTH/2-100,HEIGHT/2-25,200,50)) { fullscreen = !fullscreen; }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+50,200,50)) { gameState=MENU; }
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
const joy = document.getElementById("joystick"), stick = document.getElementById("stick");
joy.addEventListener("touchstart", joyTouch, {passive:false});
joy.addEventListener("touchmove", joyTouch, {passive:false});
joy.addEventListener("touchend", joyEnd, {passive:false});
function joyTouch(e) {
  let t = null;
  for (let i=0;i<e.touches.length;i++) {
    if (!joyTouchId || e.touches[i].identifier===joyTouchId) { t = e.touches[i]; joyTouchId = e.touches[i].identifier; break; }
  }
  if (!t) return;
  let rect = joy.getBoundingClientRect();
  let x = t.clientX-rect.left-rect.width/2, y = t.clientY-rect.top-rect.height/2;
  let dist = Math.sqrt(x*x+y*y), max = rect.width/2-rect.width*0.18;
  if (dist>max) { x*=max/dist; y*=max/dist; }
  stick.style.left = (x/rect.width*100+50-8)+"vw";
  stick.style.top = (y/rect.height*100+50-8)+"vw";
  joyActive=true;
  joyDX = x/max; joyDY = y/max;
  e.preventDefault();
}
function joyEnd(e) {
  joyActive=false; joyDX=0; joyDY=0; joyTouchId=null;
  stick.style.left="7vw"; stick.style.top="7vw";
}
document.getElementById("escBtn").addEventListener("touchstart",()=>{ if(gameState==PLAYING)gameState=MENU; });
document.getElementById("escBtn").addEventListener("click",()=>{ if(gameState==PLAYING)gameState=MENU; });
document.getElementById("rBtn").addEventListener("touchstart",()=>{ if(gameState==PLAYING)restartGame(); });
document.getElementById("rBtn").addEventListener("click",()=>{ if(gameState==PLAYING)restartGame(); });
loadPbData();
requestAnimationFrame(gameLoop);