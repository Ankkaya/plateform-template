<template>
  <n-modal
    :show="show"
    preset="card"
    title="编辑头像"
    style="width: 1040px"
    @update:show="emit('update:show', $event)"
  >
    <div class="avatar-editor">
      <section class="avatar-editor__panel avatar-editor__panel--workspace">
        <div
          ref="viewportRef"
          class="avatar-editor__viewport"
          @pointerdown="handleViewportPointerDown"
        >
          <img
            v-if="sourceUrl"
            ref="imageRef"
            :src="sourceUrl"
            alt="待编辑头像"
            class="avatar-editor__image"
            :style="imageStyle"
            @load="handleImageLoad"
            draggable="false"
          >

          <div
            class="avatar-editor__crop-box"
            :style="cropBoxStyle"
            @pointerdown.stop="handleCropPointerDown"
          >
            <span
              v-for="handle in cropHandles"
              :key="handle"
              class="avatar-editor__handle"
              :class="`avatar-editor__handle--${handle}`"
              @pointerdown.stop="handleResizePointerDown($event, handle)"
            />
          </div>
        </div>

        <div class="avatar-editor__toolbar">
          <div class="avatar-editor__control-group">
            <span class="avatar-editor__label">缩放</span>
            <n-slider v-model:value="scale" :min="0.6" :max="2.4" :step="0.01" />
          </div>

          <div class="avatar-editor__control-group">
            <span class="avatar-editor__label">旋转</span>
            <n-slider v-model:value="rotation" :min="-180" :max="180" :step="1" />
          </div>

          <n-space>
            <n-button @click="flipHorizontal">水平镜像</n-button>
            <n-button @click="flipVertical">垂直镜像</n-button>
            <n-button @click="rotateLeft">左转 90°</n-button>
            <n-button @click="rotateRight">右转 90°</n-button>
            <n-button quaternary @click="resetEditor">重置</n-button>
          </n-space>
        </div>
      </section>

      <section class="avatar-editor__panel avatar-editor__panel--preview">
        <div class="avatar-editor__preview-header">结果预览</div>
        <canvas ref="canvasRef" width="320" height="320" class="avatar-editor__canvas" />
      </section>
    </div>

    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :disabled="!imageLoaded" @click="handleConfirm">
          确定
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  sourceUrl: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [payload: { blob: Blob; previewUrl: string }]
}>()

type ResizeHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

const PREVIEW_SIZE = 320
const MIN_CROP_SIZE = 96

const cropHandles: ResizeHandle[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

const viewportRef = ref<HTMLDivElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const imageLoaded = ref(false)
const scale = ref(1)
const rotation = ref(0)
const flipX = ref(1)
const flipY = ref(1)

const imageMetrics = reactive({
  naturalWidth: 0,
  naturalHeight: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  baseWidth: 0,
  baseHeight: 0,
})

const imagePosition = reactive({
  x: 0,
  y: 0,
})

const cropBox = reactive({
  x: 80,
  y: 60,
  size: 240,
})

let activePointerId: number | null = null
let activePointerMode: 'image' | 'crop' | 'resize' | null = null
let activeResizeHandle: ResizeHandle | null = null
const pointerStart = reactive({
  x: 0,
  y: 0,
  imageX: 0,
  imageY: 0,
  cropX: 0,
  cropY: 0,
  cropSize: 0,
})

const imageStyle = computed(() => ({
  width: `${imageMetrics.baseWidth}px`,
  height: `${imageMetrics.baseHeight}px`,
  transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) rotate(${rotation.value}deg) scale(${scale.value * flipX.value}, ${scale.value * flipY.value})`,
}))

const cropBoxStyle = computed(() => ({
  width: `${cropBox.size}px`,
  height: `${cropBox.size}px`,
  transform: `translate(${cropBox.x}px, ${cropBox.y}px)`,
}))

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getViewportRect() {
  return viewportRef.value?.getBoundingClientRect()
}

function syncViewportMetrics() {
  const rect = getViewportRect()
  if (!rect) {
    return
  }

  imageMetrics.viewportWidth = rect.width
  imageMetrics.viewportHeight = rect.height
}

function resetCropBox() {
  syncViewportMetrics()
  const size = Math.max(
    MIN_CROP_SIZE,
    Math.min(imageMetrics.viewportWidth, imageMetrics.viewportHeight) - 72,
  )
  cropBox.size = size
  cropBox.x = (imageMetrics.viewportWidth - size) / 2
  cropBox.y = (imageMetrics.viewportHeight - size) / 2
}

function resetEditor() {
  scale.value = 1
  rotation.value = 0
  flipX.value = 1
  flipY.value = 1
  imagePosition.x = 0
  imagePosition.y = 0
  resetCropBox()
}

function drawPreview() {
  const canvas = canvasRef.value
  const image = imageRef.value
  const viewport = viewportRef.value
  if (!canvas || !image || !viewport || !imageLoaded.value) {
    return
  }

  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  const viewportRect = viewport.getBoundingClientRect()
  const imageRect = image.getBoundingClientRect()
  const cropLeft = viewportRect.left + cropBox.x
  const cropTop = viewportRect.top + cropBox.y

  const scaleX = PREVIEW_SIZE / cropBox.size
  const scaleY = PREVIEW_SIZE / cropBox.size

  context.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
  context.fillStyle = 'rgba(255,255,255,0.98)'
  context.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)

  context.save()
  context.beginPath()
  context.rect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
  context.clip()
  context.translate(-(cropLeft - imageRect.left) * scaleX, -(cropTop - imageRect.top) * scaleY)
  context.drawImage(
    image,
    0,
    0,
    imageRect.width * scaleX,
    imageRect.height * scaleY,
  )
  context.restore()
}

function loadImageState() {
  const image = imageRef.value
  const viewport = viewportRef.value
  if (!image || !viewport) {
    return
  }

  syncViewportMetrics()

  const naturalWidth = image.naturalWidth || 1
  const naturalHeight = image.naturalHeight || 1
  imageMetrics.naturalWidth = naturalWidth
  imageMetrics.naturalHeight = naturalHeight

  const fitScale = Math.min(
    imageMetrics.viewportWidth / naturalWidth,
    imageMetrics.viewportHeight / naturalHeight,
  )

  imageMetrics.baseWidth = naturalWidth * fitScale
  imageMetrics.baseHeight = naturalHeight * fitScale

  imagePosition.x = (imageMetrics.viewportWidth - imageMetrics.baseWidth) / 2
  imagePosition.y = (imageMetrics.viewportHeight - imageMetrics.baseHeight) / 2
  resetCropBox()
  imageLoaded.value = true
  drawPreview()
}

function releasePointerCapture() {
  if (activePointerId !== null && viewportRef.value?.hasPointerCapture(activePointerId)) {
    viewportRef.value.releasePointerCapture(activePointerId)
  }
  activePointerId = null
  activePointerMode = null
  activeResizeHandle = null
}

function startPointer(event: PointerEvent, mode: 'image' | 'crop' | 'resize', handle?: ResizeHandle) {
  activePointerId = event.pointerId
  activePointerMode = mode
  activeResizeHandle = handle ?? null
  viewportRef.value?.setPointerCapture(event.pointerId)
  pointerStart.x = event.clientX
  pointerStart.y = event.clientY
  pointerStart.imageX = imagePosition.x
  pointerStart.imageY = imagePosition.y
  pointerStart.cropX = cropBox.x
  pointerStart.cropY = cropBox.y
  pointerStart.cropSize = cropBox.size
}

function handleViewportPointerDown(event: PointerEvent) {
  if (!imageLoaded.value) {
    return
  }
  startPointer(event, 'image')
}

function handleCropPointerDown(event: PointerEvent) {
  startPointer(event, 'crop')
}

function handleResizePointerDown(event: PointerEvent, handle: ResizeHandle) {
  startPointer(event, 'resize', handle)
}

function resizeCropBox(deltaX: number, deltaY: number) {
  const maxSizeFromLeft = pointerStart.cropX + pointerStart.cropSize
  const maxSizeFromTop = pointerStart.cropY + pointerStart.cropSize
  const maxRight = imageMetrics.viewportWidth - pointerStart.cropX
  const maxBottom = imageMetrics.viewportHeight - pointerStart.cropY

  if (activeResizeHandle === 'bottom-right') {
    const nextSize = clamp(
      pointerStart.cropSize + Math.max(deltaX, deltaY),
      MIN_CROP_SIZE,
      Math.min(maxRight, maxBottom),
    )
    cropBox.size = nextSize
    return
  }

  if (activeResizeHandle === 'bottom-left') {
    const nextSize = clamp(
      pointerStart.cropSize + Math.max(-deltaX, deltaY),
      MIN_CROP_SIZE,
      Math.min(maxSizeFromLeft, maxBottom),
    )
    cropBox.size = nextSize
    cropBox.x = pointerStart.cropX + (pointerStart.cropSize - nextSize)
    return
  }

  if (activeResizeHandle === 'top-right') {
    const nextSize = clamp(
      pointerStart.cropSize + Math.max(deltaX, -deltaY),
      MIN_CROP_SIZE,
      Math.min(maxRight, maxSizeFromTop),
    )
    cropBox.size = nextSize
    cropBox.y = pointerStart.cropY + (pointerStart.cropSize - nextSize)
    return
  }

  if (activeResizeHandle === 'top-left') {
    const nextSize = clamp(
      pointerStart.cropSize + Math.max(-deltaX, -deltaY),
      MIN_CROP_SIZE,
      Math.min(maxSizeFromLeft, maxSizeFromTop),
    )
    cropBox.size = nextSize
    cropBox.x = pointerStart.cropX + (pointerStart.cropSize - nextSize)
    cropBox.y = pointerStart.cropY + (pointerStart.cropSize - nextSize)
  }
}

function handlePointerMove(event: PointerEvent) {
  if (activePointerId !== event.pointerId || !activePointerMode) {
    return
  }

  const deltaX = event.clientX - pointerStart.x
  const deltaY = event.clientY - pointerStart.y

  if (activePointerMode === 'image') {
    imagePosition.x = pointerStart.imageX + deltaX
    imagePosition.y = pointerStart.imageY + deltaY
    drawPreview()
    return
  }

  if (activePointerMode === 'crop') {
    cropBox.x = clamp(pointerStart.cropX + deltaX, 0, imageMetrics.viewportWidth - cropBox.size)
    cropBox.y = clamp(pointerStart.cropY + deltaY, 0, imageMetrics.viewportHeight - cropBox.size)
    drawPreview()
    return
  }

  if (activePointerMode === 'resize') {
    resizeCropBox(deltaX, deltaY)
    cropBox.x = clamp(cropBox.x, 0, imageMetrics.viewportWidth - cropBox.size)
    cropBox.y = clamp(cropBox.y, 0, imageMetrics.viewportHeight - cropBox.size)
    drawPreview()
  }
}

function handlePointerUp(event: PointerEvent) {
  if (activePointerId !== event.pointerId) {
    return
  }
  releasePointerCapture()
}

function flipHorizontal() {
  flipX.value = flipX.value * -1
}

function flipVertical() {
  flipY.value = flipY.value * -1
}

function rotateLeft() {
  rotation.value -= 90
}

function rotateRight() {
  rotation.value += 90
}

function handleImageLoad() {
  loadImageState()
}

async function handleConfirm() {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  drawPreview()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/png', 0.92)
  })

  if (!blob) {
    return
  }

  const previewUrl = URL.createObjectURL(blob)
  emit('confirm', { blob, previewUrl })
  emit('update:show', false)
}

watch(
  () => props.show,
  async (visible) => {
    if (!visible) {
      return
    }

    imageLoaded.value = false
    await nextTick()
    resetEditor()
  },
  { immediate: true },
)

watch(
  [scale, rotation, flipX, flipY],
  () => {
    drawPreview()
  },
)

watch(
  () => props.show,
  (visible) => {
    const target = viewportRef.value
    if (!target) {
      return
    }

    if (visible) {
      target.addEventListener('pointermove', handlePointerMove)
      target.addEventListener('pointerup', handlePointerUp)
      target.addEventListener('pointercancel', handlePointerUp)
      return
    }

    target.removeEventListener('pointermove', handlePointerMove)
    target.removeEventListener('pointerup', handlePointerUp)
    target.removeEventListener('pointercancel', handlePointerUp)
    releasePointerCapture()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  const target = viewportRef.value
  target?.removeEventListener('pointermove', handlePointerMove)
  target?.removeEventListener('pointerup', handlePointerUp)
  target?.removeEventListener('pointercancel', handlePointerUp)
  releasePointerCapture()
})
</script>

<style scoped>
.avatar-editor {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.9fr);
  gap: 24px;
  align-items: start;
}

.avatar-editor__panel {
  border: 1px solid var(--n-border-color, rgba(15, 23, 42, 0.08));
  border-radius: 18px;
  background: var(--n-color-modal, #fff);
  padding: 18px;
}

.avatar-editor__viewport {
  position: relative;
  overflow: hidden;
  height: 420px;
  border-radius: 18px;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--n-primary-color, #2080f0) 16%, transparent), transparent 55%),
    var(--n-color-embedded, #f8fafc);
  border: 1px solid var(--n-border-color, rgba(148, 163, 184, 0.24));
  user-select: none;
  touch-action: none;
}

.avatar-editor__viewport::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 32px 32px;
}

.avatar-editor__image {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: center center;
  will-change: transform;
}

.avatar-editor__crop-box {
  position: absolute;
  top: 0;
  left: 0;
  border: 2px solid var(--n-primary-color, #2080f0);
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.42);
  cursor: move;
}

.avatar-editor__crop-box::before,
.avatar-editor__crop-box::after {
  content: '';
  position: absolute;
  background: rgba(255, 255, 255, 0.45);
}

.avatar-editor__crop-box::before {
  top: 0;
  bottom: 0;
  left: 33.333%;
  width: 1px;
  box-shadow: 85px 0 0 rgba(255, 255, 255, 0.45);
}

.avatar-editor__crop-box::after {
  left: 0;
  right: 0;
  top: 33.333%;
  height: 1px;
  box-shadow: 0 85px 0 rgba(255, 255, 255, 0.45);
}

.avatar-editor__handle {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--n-primary-color, #2080f0);
  border: 2px solid white;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.22);
}

.avatar-editor__handle--top-left {
  top: -8px;
  left: -8px;
  cursor: nwse-resize;
}

.avatar-editor__handle--top-right {
  top: -8px;
  right: -8px;
  cursor: nesw-resize;
}

.avatar-editor__handle--bottom-left {
  bottom: -8px;
  left: -8px;
  cursor: nesw-resize;
}

.avatar-editor__handle--bottom-right {
  right: -8px;
  bottom: -8px;
  cursor: nwse-resize;
}

.avatar-editor__toolbar {
  margin-top: 18px;
}

.avatar-editor__control-group {
  margin-bottom: 16px;
}

.avatar-editor__label {
  display: block;
  margin-bottom: 8px;
  color: var(--n-text-color-2, #334155);
  font-size: 14px;
  font-weight: 600;
}

.avatar-editor__preview-header {
  margin-bottom: 12px;
  color: var(--n-text-color, #0f172a);
  font-size: 15px;
  font-weight: 700;
  text-align: center;
}

.avatar-editor__canvas {
  display: block;
  width: 320px;
  height: 320px;
  margin: 0 auto;
  border-radius: 20px;
  border: 1px solid var(--n-border-color, rgba(148, 163, 184, 0.3));
  background: var(--n-color-embedded, #f8fafc);
}

@media (max-width: 980px) {
  .avatar-editor {
    grid-template-columns: 1fr;
  }

  .avatar-editor__viewport {
    height: 360px;
  }
}
</style>
