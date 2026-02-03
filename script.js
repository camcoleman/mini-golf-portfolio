const course = document.querySelector("#course");
const ball = document.querySelector("#ball");
const aim = document.querySelector("#aim");
const aimLine = document.querySelector("#aim-line");
const aimHead = document.querySelector("#aim-head");
const holes = Array.from(document.querySelectorAll(".hole"));
const cards = Array.from(document.querySelectorAll(".club-card"));
const obstacles = Array.from(document.querySelectorAll("[data-type]"));

const state = {
  ball: { x: 120, y: 420, radius: 13 },
  velocity: { x: 0, y: 0 },
  drag: null,
  dragging: false,
  courseRect: null,
  completed: new Set(),
  obstacleRects: [],
};

const physics = {
  friction: 0.97,
  stopThreshold: 0.2,
  power: 0.045,
  maxPull: 140,
  bounce: 0.6,
  holeRadius: 20,
  sandSlow: 0.94,
};

const updateCourseRect = () => {
  state.courseRect = course.getBoundingClientRect();
};

const setBallPosition = (x, y) => {
  state.ball.x = x;
  state.ball.y = y;
  ball.style.left = `${x}px`;
  ball.style.top = `${y}px`;
};

const resetBall = () => {
  const padding = 40;
  setBallPosition(padding + 40, course.clientHeight - padding - 40);
  state.velocity.x = 0;
  state.velocity.y = 0;
};

const getPointer = (event) => {
  const { left, top } = state.courseRect;
  const point = event.touches ? event.touches[0] : event;
  return { x: point.clientX - left, y: point.clientY - top };
};

const distance = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const setAim = (start, end) => {
  aimLine.setAttribute("x1", start.x);
  aimLine.setAttribute("y1", start.y);
  aimLine.setAttribute("x2", end.x);
  aimLine.setAttribute("y2", end.y);

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headSize = 10;
  const left = {
    x: end.x - headSize * Math.cos(angle - Math.PI / 6),
    y: end.y - headSize * Math.sin(angle - Math.PI / 6),
  };
  const right = {
    x: end.x - headSize * Math.cos(angle + Math.PI / 6),
    y: end.y - headSize * Math.sin(angle + Math.PI / 6),
  };

  aimHead.setAttribute(
    "points",
    `${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`
  );
  aim.style.opacity = "1";
};

const clearAim = () => {
  aim.style.opacity = "0";
};

const onPointerDown = (event) => {
  if (event.cancelable) event.preventDefault();
  updateCourseRect();
  const pointer = getPointer(event);
  if (distance(pointer, state.ball) <= state.ball.radius + 24) {
    state.dragging = true;
    state.drag = pointer;
    state.velocity.x = 0;
    state.velocity.y = 0;
    setAim(state.ball, pointer);
    if (event.pointerId !== undefined) {
      course.setPointerCapture(event.pointerId);
    }
  }
};

const onPointerMove = (event) => {
  if (!state.dragging) return;
  if (event.cancelable) event.preventDefault();
  const pointer = getPointer(event);
  const dragPoint = {
    x: clamp(pointer.x, 0, course.clientWidth),
    y: clamp(pointer.y, 0, course.clientHeight),
  };
  const shot = {
    x: state.ball.x + (state.ball.x - dragPoint.x),
    y: state.ball.y + (state.ball.y - dragPoint.y),
  };
  setAim(state.ball, shot);
  state.drag = dragPoint;
};

const onPointerUp = (event) => {
  if (!state.dragging) return;
  if (event.cancelable) event.preventDefault();
  state.dragging = false;
  if (event.pointerId !== undefined) {
    course.releasePointerCapture(event.pointerId);
  }

  const dx = state.ball.x - state.drag.x;
  const dy = state.ball.y - state.drag.y;
  const pullDistance = Math.hypot(dx, dy);
  const clampedPull = Math.min(pullDistance, physics.maxPull);
  const powerScale = clampedPull * physics.power;

  if (pullDistance > 5) {
    state.velocity.x = (dx / pullDistance) * powerScale * 6;
    state.velocity.y = (dy / pullDistance) * powerScale * 6;
  }

  clearAim();
};

const unlockCard = (id) => {
  const card = cards.find((item) => item.dataset.panel === id);
  if (!card) return;
  card.classList.remove("locked");
  card.classList.add("unlocked");
};

const checkHole = () => {
  for (const hole of holes) {
    const rect = hole.getBoundingClientRect();
    const holeCenter = {
      x: rect.left - state.courseRect.left + rect.width / 2,
      y: rect.top - state.courseRect.top + rect.height / 2,
    };

    const dist = distance(state.ball, holeCenter);
    if (dist < physics.holeRadius) {
      const id = hole.dataset.panel;
      if (!state.completed.has(id)) {
        state.completed.add(id);
        unlockCard(id);
      }
      state.velocity.x = 0;
      state.velocity.y = 0;
      setBallPosition(holeCenter.x, holeCenter.y);
      setTimeout(() => {
        const target = `${id}.html`;
        window.location.href = target;
      }, 500);
      break;
    }
  }
};

const updateObstacles = () => {
  state.obstacleRects = obstacles.map((obstacle) => {
    const rect = obstacle.getBoundingClientRect();
    return {
      el: obstacle,
      type: obstacle.dataset.type,
      rect,
      center: {
        x: rect.left - state.courseRect.left + rect.width / 2,
        y: rect.top - state.courseRect.top + rect.height / 2,
      },
      radius: rect.width / 2,
      width: rect.width,
      height: rect.height,
    };
  });
};

const reflect = (normal) => {
  const v = state.velocity;
  const dot = v.x * normal.x + v.y * normal.y;
  v.x = (v.x - 2 * dot * normal.x) * physics.bounce;
  v.y = (v.y - 2 * dot * normal.y) * physics.bounce;
};

const handleObstacles = () => {
  for (const obstacle of state.obstacleRects) {
    if (obstacle.type === "sand") {
      const left = obstacle.center.x - obstacle.width / 2;
      const top = obstacle.center.y - obstacle.height / 2;
      const inSand =
        state.ball.x > left &&
        state.ball.x < left + obstacle.width &&
        state.ball.y > top &&
        state.ball.y < top + obstacle.height;
      if (inSand) {
        state.velocity.x *= physics.sandSlow;
        state.velocity.y *= physics.sandSlow;
      }
      continue;
    }

    if (obstacle.type === "circle") {
      const dist = distance(state.ball, obstacle.center);
      const minDist = state.ball.radius + obstacle.radius;
      if (dist < minDist && dist > 0) {
        const normal = {
          x: (state.ball.x - obstacle.center.x) / dist,
          y: (state.ball.y - obstacle.center.y) / dist,
        };
        state.ball.x = obstacle.center.x + normal.x * minDist;
        state.ball.y = obstacle.center.y + normal.y * minDist;
        reflect(normal);
      }
      continue;
    }

    if (obstacle.type === "rect") {
      const left = obstacle.center.x - obstacle.width / 2;
      const top = obstacle.center.y - obstacle.height / 2;
      const right = left + obstacle.width;
      const bottom = top + obstacle.height;

      if (
        state.ball.x + state.ball.radius > left &&
        state.ball.x - state.ball.radius < right &&
        state.ball.y + state.ball.radius > top &&
        state.ball.y - state.ball.radius < bottom
      ) {
        const overlapX = Math.min(
          right - (state.ball.x - state.ball.radius),
          state.ball.x + state.ball.radius - left
        );
        const overlapY = Math.min(
          bottom - (state.ball.y - state.ball.radius),
          state.ball.y + state.ball.radius - top
        );
        if (overlapX < overlapY) {
          const normal = state.ball.x < obstacle.center.x ? { x: -1, y: 0 } : { x: 1, y: 0 };
          state.ball.x += normal.x * overlapX;
          reflect(normal);
        } else {
          const normal = state.ball.y < obstacle.center.y ? { x: 0, y: -1 } : { x: 0, y: 1 };
          state.ball.y += normal.y * overlapY;
          reflect(normal);
        }
      }
    }
  }
};

const update = () => {
  const { ball: ballState, velocity } = state;

  if (!state.dragging) {
    ballState.x += velocity.x;
    ballState.y += velocity.y;

    velocity.x *= physics.friction;
    velocity.y *= physics.friction;

    if (Math.abs(velocity.x) < physics.stopThreshold) velocity.x = 0;
    if (Math.abs(velocity.y) < physics.stopThreshold) velocity.y = 0;

    if (ballState.x - ballState.radius <= 0 || ballState.x + ballState.radius >= course.clientWidth) {
      velocity.x *= -physics.bounce;
      ballState.x = clamp(ballState.x, ballState.radius, course.clientWidth - ballState.radius);
    }

    if (ballState.y - ballState.radius <= 0 || ballState.y + ballState.radius >= course.clientHeight) {
      velocity.y *= -physics.bounce;
      ballState.y = clamp(ballState.y, ballState.radius, course.clientHeight - ballState.radius);
    }
  }

  setBallPosition(ballState.x, ballState.y);
  handleObstacles();
  checkHole();
  requestAnimationFrame(update);
};

updateCourseRect();
updateObstacles();
resetBall();
clearAim();

course.addEventListener("pointerdown", onPointerDown);
course.addEventListener("pointermove", onPointerMove);
course.addEventListener("pointerup", onPointerUp);
course.addEventListener("pointerleave", onPointerUp);
course.addEventListener("mousedown", onPointerDown);
course.addEventListener("mousemove", onPointerMove);
course.addEventListener("mouseup", onPointerUp);
course.addEventListener("touchstart", onPointerDown, { passive: true });
course.addEventListener("touchmove", onPointerMove, { passive: true });
course.addEventListener("touchend", onPointerUp);

window.addEventListener("resize", () => {
  updateCourseRect();
  updateObstacles();
  resetBall();
});

update();
