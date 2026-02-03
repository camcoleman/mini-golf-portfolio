const courses = Array.from(document.querySelectorAll(".course"));
if (!courses.length) {
  // No playable courses on this page.
}

const physics = {
  friction: 0.97,
  stopThreshold: 0.2,
  power: 0.06,
  maxPull: 160,
  bounce: 0.7,
  holeRadius: 22,
  sandSlow: 0.94,
};

const initCourse = (course) => {
  const ball = course.querySelector("[data-ball]");
  const hole = course.querySelector("[data-hole]");
  const aim = course.querySelector(".aim");
  const aimLine = course.querySelector(".aim-line");
  const aimHead = course.querySelector(".aim-head");
  const target = course.dataset.target;
  const obstacles = Array.from(course.querySelectorAll("[data-type]"));

  if (!ball || !hole || !aim || !aimLine || !aimHead) return;

  const state = {
    ball: { x: 0, y: 0, radius: 13 },
    velocity: { x: 0, y: 0 },
    drag: null,
    dragging: false,
    rect: null,
    obstacleRects: [],
  };

  const updateRect = () => {
    state.rect = course.getBoundingClientRect();
  };

  const setBallPosition = (x, y) => {
    state.ball.x = x;
    state.ball.y = y;
    ball.style.left = `${x}px`;
    ball.style.top = `${y}px`;
  };

  const getPointer = (event) => {
    const { left, top } = state.rect;
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
    updateRect();
    const pointer = getPointer(event);
    if (distance(pointer, state.ball) <= state.ball.radius + 24) {
      state.dragging = true;
      state.drag = pointer;
      state.velocity.x = 0;
      state.velocity.y = 0;
      const shot = {
        x: state.ball.x + (state.ball.x - pointer.x),
        y: state.ball.y + (state.ball.y - pointer.y),
      };
      setAim(state.ball, shot);
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

  const updateObstacles = () => {
    state.obstacleRects = obstacles.map((obstacle) => {
      const rect = obstacle.getBoundingClientRect();
      return {
        type: obstacle.dataset.type,
        center: {
          x: rect.left - state.rect.left + rect.width / 2,
          y: rect.top - state.rect.top + rect.height / 2,
        },
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
    if (!state.dragging) {
      state.ball.x += state.velocity.x;
      state.ball.y += state.velocity.y;

      state.velocity.x *= physics.friction;
      state.velocity.y *= physics.friction;

      if (Math.abs(state.velocity.x) < physics.stopThreshold) state.velocity.x = 0;
      if (Math.abs(state.velocity.y) < physics.stopThreshold) state.velocity.y = 0;

      if (state.ball.x - state.ball.radius <= 0 || state.ball.x + state.ball.radius >= course.clientWidth) {
        state.velocity.x *= -physics.bounce;
        state.ball.x = clamp(state.ball.x, state.ball.radius, course.clientWidth - state.ball.radius);
      }

      if (state.ball.y - state.ball.radius <= 0 || state.ball.y + state.ball.radius >= course.clientHeight) {
        state.velocity.y *= -physics.bounce;
        state.ball.y = clamp(state.ball.y, state.ball.radius, course.clientHeight - state.ball.radius);
      }
    }

    setBallPosition(state.ball.x, state.ball.y);
    handleObstacles();

    const holeRect = hole.getBoundingClientRect();
    const holeCenter = {
      x: holeRect.left - state.rect.left + holeRect.width / 2,
      y: holeRect.top - state.rect.top + holeRect.height / 2,
    };
    const dist = distance(state.ball, holeCenter);
    if (dist < physics.holeRadius && target) {
      setTimeout(() => {
        window.location.href = target;
      }, 300);
    }

    requestAnimationFrame(update);
  };

  updateRect();
  updateObstacles();
  const startLeft = parseFloat(ball.style.left) || course.clientWidth * 0.2;
  const startTop = parseFloat(ball.style.top) || course.clientHeight * 0.8;
  setBallPosition(startLeft, startTop);
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
    updateRect();
    updateObstacles();
    setBallPosition(startLeft, startTop);
  });

  update();
};

courses.forEach(initCourse);
