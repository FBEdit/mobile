const WIDTH = 800, HEIGHT = 600, FPS = 60;
const COLORS = {
  BLACK: "#000", WHITE: "#fff", RED: "#f00", GREEN: "#0f0", BLUE: "#00f",
  YELLOW: "#ff0", PURPLE: "#800080"
};
const MENU = 0, PLAYING = 1, GAME_OVER = 2, LEADERBOARD = 3, REPLAY = 4, SETTINGS = 5, ROOM_SELECT = 6;
let gameState = MENU, aspectMode = "stretched", btnSide = "right", joystickFullSpeed = false;
let joySize = 16, btnSize = 12;
let player = {x:50, y:HEIGHT/2, w:40, h:40}, goal = {x:WIDTH-100, y:HEIGHT-100, w:50, h:50};
let keyObj = randRect(30,30), door = {x:WIDTH/2-25, y:HEIGHT/2-50, w:50, h:100};
let obstacles = Array.from({length:5},()=>randRect(60,60));
let speed = 5, timerStarted = false, startTime = 0, endTime = 0, hasKey = false;
let level = 1, maxLevel = 3, replayData = [], pbData = {}, currentReplay = null, replayFrame = 0, replayPaused = true;
let joyActive = false, joyDX = 0, joyDY = 0, joyTouchId = null;
let leaderboardMode = "3rooms", leaderboardKeyMode = "withkey";
let leaderboardCategories = [
  {mode: "1room", name: "1 ROOM"},
  {mode: "3rooms", name: "3 ROOMS"},
  {mode: "5rooms", name: "5 ROOMS"}
];
let leaderboardKeyCats = [
  {keymode:"withkey", name:"WITH KEY"},
  {keymode:"nonkey", name:"NON KEY"}
];
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const joy = document.getElementById("joystick");
const stick = document.getElementById("stick");
const escBtn = document.getElementById("escBtn");
const rBtn = document.getElementById("rBtn");
const catPanel = document.getElementById("leaderboard-cats");
let cooldownActive = false;
let deleteConfirmState = {};

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
  maxLevel = leaderboardMode=="1room"?1:leaderboardMode=="5rooms"?5:3;
  resetLevel();
  player.x = 50; player.y = HEIGHT/2;
  gameState = PLAYING;
}
function saveRun() {
  let run_time = endTime - startTime;
  let serialized = replayData.map(frame=>({
    player:{...frame.player}, key:{...frame.key}, door:{...frame.door},
    obstacles:frame.obstacles.map(o=>({...o})), has_key:frame.has_key, key_taken:frame.key_taken, door_opened:frame.door_opened
  }));
  let encoded = btoa(unescape(encodeURIComponent(JSON.stringify(serialized))));
  let run_entry = {
    time:run_time,
    replay:encoded,
    mode:leaderboardMode,
    keys:runKeyCount(serialized),
    doors:runDoorCount(serialized)
  };
  let runs = pbData[leaderboardMode]||(pbData[leaderboardMode]=[]);
  runs.push(run_entry);
  pbData[leaderboardMode] = runs;
  localStorage.setItem("fb_pb",JSON.stringify(pbData));
}
function runKeyCount(frames) {
  let count = 0, prev = false;
  for(let f of frames) {
    if (f.has_key && !prev) count++;
    prev = f.has_key;
  }
  return count;
}
function runDoorCount(frames) {
  let count = 0, prev = false;
  for(let f of frames) {
    let opened = f.door&&f.door.x==-100&&f.door.y==-100;
    if (opened && !prev) count++;
    prev = opened;
  }
  return count;
}
function loadPbData() {
  pbData = {};
  let d = localStorage.getItem("fb_pb");
  if (d) try { pbData = JSON.parse(d); } catch {}
  if (typeof pbData!=="object"||!pbData) pbData = {};
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
function drawRoomSelect() {
  ctx.fillStyle=COLORS.BLACK; ctx.fillRect(0,0,WIDTH,HEIGHT);
  drawText("SELECT ROOMS", WIDTH/2, HEIGHT/4, 48, COLORS.WHITE);
  drawBtn(WIDTH/2-150, HEIGHT/2-60, 120, 60, COLORS.GREEN, "1 ROOM");
  drawBtn(WIDTH/2-60, HEIGHT/2-60, 120, 60, COLORS.YELLOW, "3 ROOMS");
  drawBtn(WIDTH/2+30, HEIGHT/2-60, 120, 60, COLORS.PURPLE, "5 ROOMS");
  drawBtn(WIDTH/2-100, HEIGHT/2+40, 200, 50, COLORS.BLUE, "BACK");
}
function drawSettings() {
  ctx.fillStyle=COLORS.BLACK; ctx.fillRect(0,0,WIDTH,HEIGHT);
  drawText("SETTINGS", WIDTH/2, HEIGHT/4, 48, COLORS.WHITE);
  drawBtn(WIDTH/2-100, HEIGHT/2-90, 200, 50, aspectMode=="stretched"?COLORS.GREEN:COLORS.BLUE, "ASPECT: "+(aspectMode=="stretched"?"STRETCHED":"4:3"));
  drawBtn(WIDTH/2-100, HEIGHT/2-25, 200, 50, btnSide=="right"?COLORS.GREEN:COLORS.BLUE, "BUTTONS: "+(btnSide=="right"?"RIGHT":"LEFT"));
  drawBtn(WIDTH/2-100, HEIGHT/2+40, 95, 50, COLORS.PURPLE, "-");
  drawText("JSZ", WIDTH/2, HEIGHT/2+70, 20, COLORS.WHITE);
  drawBtn(WIDTH/2+5, HEIGHT/2+40, 95, 50, COLORS.PURPLE, "+");
  drawBtn(WIDTH/2-100, HEIGHT/2+105, 95, 50, COLORS.YELLOW, "-");
  drawText("BTN", WIDTH/2, HEIGHT/2+135, 20, COLORS.WHITE);
  drawBtn(WIDTH/2+5, HEIGHT/2+105, 95, 50, COLORS.YELLOW, "+");
  drawBtn(WIDTH/2-100, HEIGHT/2+170, 200, 50, joystickFullSpeed?COLORS.GREEN:COLORS.BLUE, "JOYSTICK FULL SPEED");
  drawText("If ON, joystick always moves at max speed", WIDTH/2, HEIGHT/2+205, 19, "#ccc");
  drawBtn(WIDTH/2-100, HEIGHT/2+235, 200, 50, COLORS.BLUE, "BACK");
}
function drawLeaderboard() {
  ctx.fillStyle=COLORS.BLACK; ctx.fillRect(0,0,WIDTH,HEIGHT);
  drawText("LEADERBOARD", WIDTH/2, 50, 40, COLORS.WHITE);
  drawBtn(50, 50, 100, 40, COLORS.RED, "BACK");
  let runs = (pbData[leaderboardMode]||[]).slice();
  let y = 120, displayed = 0;
  let keyRequired = leaderboardKeyMode=="withkey";
  let maxRooms = leaderboardMode=="1room"?1:leaderboardMode=="5rooms"?5:3;
  runs = runs.filter(run=>{
    if(keyRequired) return run.keys>=maxRooms && run.doors>=maxRooms;
    return true;
  });
  runs = runs.sort((a,b)=>a.time-b.time).slice(0,10);
  for (let i=0;i<runs.length;i++) {
    let run = runs[i];
    drawText(`${i+1}. ${run.time.toFixed(2)}s`, WIDTH/2-180, y+25, 28, COLORS.WHITE, "left");
    drawBtn(WIDTH/2+20, y, 85, 30, COLORS.PURPLE, "REPLAY");
    let delText = deleteConfirmState[run.replay]===2 ? "CONFIRM" : deleteConfirmState[run.replay]===1 ? "CONFIRM" : "DELETE";
    let delColor = deleteConfirmState[run.replay]===2 ? COLORS.YELLOW : deleteConfirmState[run.replay]===1 ? COLORS.RED : COLORS.RED;
    drawBtn(WIDTH/2+110, y, 85, 30, delColor, delText);
    y+=40; displayed++;
  }
  if(displayed==0) drawText("No runs in this category yet!", WIDTH/2, 220, 24, "#aaa");
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
  if (collide(player,keyObj)) { hasKey=true; keyObj.x=-100; keyObj.y=-100; key_taken_this = true; }
  if (collide(player,door)&&hasKey) { door.x=-100; door.y=-100; door_opened_this = true; }
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
  if (joyActive) {
    if(joystickFullSpeed) {
      let mag = Math.sqrt(joyDX*joyDX+joyDY*joyDY);
      if(mag>0) {
        dx = speed * (joyDX/mag);
        dy = speed * (joyDY/mag);
      }
    } else {
      dx=joyDX*speed; dy=joyDY*speed;
    }
  }
  player.x+=dx; player.y+=dy;
  if ((dx||dy)&&!timerStarted) { timerStarted=true; startTime=Date.now()/1000; }
}
let key_taken_this = false, door_opened_this = false;
function recordFrame() {
  replayData.push({
    player:{...player}, key:{...keyObj}, door:{...door},
    obstacles:obstacles.map(o=>({...o})), has_key:hasKey,
    key_taken:key_taken_this, door_opened:door_opened_this
  });
  key_taken_this = false; door_opened_this = false;
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
  else if (gameState==ROOM_SELECT) drawRoomSelect();
  else if (gameState==SETTINGS) drawSettings();
  catPanel.className = gameState==LEADERBOARD?"active":"";
  requestAnimationFrame(gameLoop);
}
function handleResize() {
  let ar = window.innerWidth/window.innerHeight;
  if (aspectMode=="4:3") {
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
  } else {
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
  }
  joy.style.setProperty('--joy-size',`${joySize}vw`);
  joy.style.setProperty('--thumb-size',`${Math.round(joySize*0.35)}vw`);
  escBtn.style.setProperty('--btn-width',`${btnSize}vw`);
  escBtn.style.setProperty('--btn-height',`${btnSize*0.67}vw`);
  rBtn.style.setProperty('--btn-width',`${btnSize}vw`);
  rBtn.style.setProperty('--btn-height',`${btnSize*0.67}vw`);
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
function triggerCooldown() {
  cooldownActive = true;
  setTimeout(()=>{cooldownActive=false;},300);
}
function handleClick(x,y) {
  if (cooldownActive) return;
  if (gameState==MENU) {
    if (inRect(x,y,WIDTH/2-100,HEIGHT/2-50,200,50)) { gameState = ROOM_SELECT; triggerCooldown(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+20,200,50)) { updateLeaderboardPanel(); gameState=LEADERBOARD; triggerCooldown(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+90,200,50)) { gameState=SETTINGS; triggerCooldown(); }
  } else if (gameState==ROOM_SELECT) {
    if(inRect(x,y,WIDTH/2-150,HEIGHT/2-60,120,60)) { leaderboardMode="1room"; maxLevel=1; gameState=PLAYING; restartGame(); triggerCooldown(); }
    else if(inRect(x,y,WIDTH/2-60,HEIGHT/2-60,120,60)) { leaderboardMode="3rooms"; maxLevel=3; gameState=PLAYING; restartGame(); triggerCooldown(); }
    else if(inRect(x,y,WIDTH/2+30,HEIGHT/2-60,120,60)) { leaderboardMode="5rooms"; maxLevel=5; gameState=PLAYING; restartGame(); triggerCooldown(); }
    else if(inRect(x,y,WIDTH/2-100,HEIGHT/2+40,200,50)) { gameState=MENU; triggerCooldown(); }
  } else if (gameState==SETTINGS) {
    if (inRect(x,y,WIDTH/2-100,HEIGHT/2-90,200,50)) { aspectMode = aspectMode=="stretched"?"4:3":"stretched"; handleResize(); triggerCooldown(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2-25,200,50)) { btnSide = btnSide=="right"?"left":"right"; handleResize(); triggerCooldown(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+40,95,50)) { joySize = Math.max(1, joySize-1); handleResize(); triggerCooldown(); }
    else if (inRect(x,y,WIDTH/2+5,HEIGHT/2+40,95,50)) { joySize = joySize+1; handleResize(); triggerCooldown(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+105,95,50)) { btnSize = Math.max(1, btnSize-1); handleResize(); triggerCooldown(); }
    else if (inRect(x,y,WIDTH/2+5,HEIGHT/2+105,95,50)) { btnSize = btnSize+1; handleResize(); triggerCooldown(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+170,200,50)) { joystickFullSpeed = !joystickFullSpeed; triggerCooldown(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+235,200,50)) { gameState=MENU; triggerCooldown(); }
  } else if (gameState==GAME_OVER) {
    if (inRect(x,y,WIDTH/2-100,HEIGHT/2,200,50)) { gameState=MENU; triggerCooldown(); }
    else if (inRect(x,y,WIDTH/2-100,HEIGHT/2+70,200,50)) { updateLeaderboardPanel(); gameState=LEADERBOARD; triggerCooldown(); }
  } else if (gameState==LEADERBOARD) {
    if (inRect(x,y,50,50,100,40)) { gameState=MENU; triggerCooldown(); }
    let runs = (pbData[leaderboardMode]||[]).slice();
    let yBtn = 120;
    let keyRequired = leaderboardKeyMode=="withkey";
    let maxRooms = leaderboardMode=="1room"?1:leaderboardMode=="5rooms"?5:3;
    runs = runs.filter(run=>{
      if(keyRequired) return run.keys>=maxRooms && run.doors>=maxRooms;
      return true;
    });
    runs = runs.sort((a,b)=>a.time-b.time).slice(0,10);
    for (let i=0;i<runs.length;i++) {
      let run = runs[i];
      if (inRect(x,y,WIDTH/2+20,yBtn,85,30)) { startReplay(run.replay); triggerCooldown(); }
      if (inRect(x,y,WIDTH/2+110,yBtn,85,30)) {
        let id = run.replay;
        if(!deleteConfirmState[id]) deleteConfirmState[id]=1;
        else if(deleteConfirmState[id]===1) deleteConfirmState[id]=2;
        else if(deleteConfirmState[id]===2) { deleteRun(i,keyRequired,maxRooms); deleteConfirmState[id]=0; }
        triggerCooldown();
        break;
      }
      yBtn+=40;
    }
  } else if (gameState==REPLAY) {
    if (inRect(x,y,50,50,100,40)) { updateLeaderboardPanel(); gameState=LEADERBOARD; triggerCooldown(); }
    if (inRect(x,y,WIDTH/2-60,HEIGHT-80,120,50)) { replayPaused=!replayPaused; triggerCooldown(); }
  }
}
function inRect(x,y,rx,ry,rw,rh) { return x>=rx&&x<=rx+rw&&y>=ry&&y<=ry+rh; }
function updateLeaderboardPanel() {
  catPanel.innerHTML = "";
  if(gameState!=LEADERBOARD) {catPanel.className="";return;}
  let info = document.createElement("button");
  info.className = "lb-cat-btn info";
  info.disabled = true;
  info.textContent = "CATEGORIES";
  catPanel.appendChild(info);
  leaderboardCategories.forEach(cat=>{
    let b = document.createElement("button");
    b.className = "lb-cat-btn"+(leaderboardMode==cat.mode?" active":"");
    b.textContent = cat.name;
    b.onclick = ()=>{ if(!cooldownActive){ leaderboardMode=cat.mode; updateLeaderboardPanel(); triggerCooldown(); }};
    catPanel.appendChild(b);
  });
  let info2 = document.createElement("button");
  info2.className = "lb-cat-btn info";
  info2.disabled = true;
  info2.textContent = "MODE";
  catPanel.appendChild(info2);
  leaderboardKeyCats.forEach(cat=>{
    let b = document.createElement("button");
    b.className = "lb-cat-btn"+(leaderboardKeyMode==cat.keymode?" active":"");
    b.textContent = cat.name;
    b.onclick = ()=>{ if(!cooldownActive){ leaderboardKeyMode=cat.keymode; updateLeaderboardPanel(); triggerCooldown(); }};
    catPanel.appendChild(b);
  });
}
function deleteRun(idx,keyRequired,maxRooms) {
  let runs = (pbData[leaderboardMode]||[]).slice();
  let filtered = [];
  let found = 0;
  for(let i=0,c=0;i<runs.length;i++) {
    let run = runs[i];
    if(keyRequired) {
      if(run.keys>=maxRooms&&run.doors>=maxRooms) {
        if(c==idx) {c++; found=1; continue;}
        c++;
      }
    }
    filtered.push(run);
  }
  pbData[leaderboardMode] = filtered;
  localStorage.setItem("fb_pb",JSON.stringify(pbData));
  updateLeaderboardPanel();
}
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
  joyActive=false; joyDX=0; joyDY=0; joyTouchId=null;
  stick.style.left="50%"; stick.style.top="50%";
}
escBtn.addEventListener("touchstart",()=>{ if(!cooldownActive&&gameState==PLAYING){gameState=MENU; triggerCooldown();} escBtn.classList.add("pressed"); setTimeout(()=>escBtn.classList.remove("pressed"),120); });
escBtn.addEventListener("click",()=>{ if(!cooldownActive&&gameState==PLAYING){gameState=MENU; triggerCooldown();} escBtn.classList.add("pressed"); setTimeout(()=>escBtn.classList.remove("pressed"),120); });
rBtn.addEventListener("touchstart",()=>{ if(!cooldownActive&&gameState==PLAYING){restartGame(); triggerCooldown();} rBtn.classList.add("pressed"); setTimeout(()=>rBtn.classList.remove("pressed"),120); });
rBtn.addEventListener("click",()=>{ if(!cooldownActive&&gameState==PLAYING){restartGame(); triggerCooldown();} rBtn.classList.add("pressed"); setTimeout(()=>rBtn.classList.remove("pressed"),120); });
loadPbData();
updateLeaderboardPanel();
requestAnimationFrame(gameLoop);
