<template>
  <n-modal
    :show="show"
    preset="card"
    title="编辑头像"
    style="width: 960px"
    @update:show="emit('update:show', $event)"
  >
    <div class="avatar-editor">
      <section class="avatar-editor__panel avatar-editor__panel--controls">
        <div class="avatar-editor__source">
          <img v-if="sourceUrl" :src="sourceUrl" alt="待编辑头像" class="avatar-editor__source-image">
        </div>

        <div class="avatar-editor__control-group">
          <span class="avatar-editor__label">缩放</span>
          <n-slider v-model:value="scale" :min="0.6" :max="2.4" :step="0.01" />
        </div>

        <div class="avatar-editor__control-group">
          <span class="avatar-editor__label">旋转</span>
          <n-slider v-model:value="rotation" :min="-180" :max="180" :step="1" />
        </div>

        <div class="avatar-editor__control-group">
          <span class="avatar-editor__label">水平偏移</span>
          <n-slider v-model:value="offsetX" :min="-120" :max="120" :step="1" />
        </div>

        <div class="avatar-editor__control-group">
          <span class="avatar-editor__label">垂直偏移</span>
          <n-slider v-model:value="offsetY" :min="-120" :max="120" :step="1" />
        </div>

        <n-space>
          <n-button @click="flipHorizontal">水平镜像</n-button>
          <n-button @click="flipVertical">垂直镜像</n-button>
          <n-button @click="rotateLeft">左转 90°</n-button>
          <n-button @click="rotateRight">右转 90°</n-button>
          <n-button quaternary @click="resetEditor">重置</n-button>
        </n-space>
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
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  sourceUrl: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [payload: { blob: Blob; previewUrl: string }]
}>()

const CANVAS_SIZE = 320

const canvasRef = ref<HTMLCanvasElement | null>(null)
const scale = ref(1)
const rotation = ref(0)
const offsetX = ref(0)
const offsetY = ref(0)
const flipX = ref(1)
const flipY = ref(1)
const imageLoaded = ref(false)
const imageElement = new Image()

function resetEditor() {
  scale.value = 1
  rotation.value = 0
  offsetX.value = 0
  offsetY.value = 0
  flipX.value = 1
  flipY.value = 1
}

function drawCanvas() {
  const canvas = canvasRef.value
  if (!canvas || !imageLoaded.value) {
    return
  }

  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  context.fillStyle = '#f5f7fa'
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  context.save()
  context.translate(CANVAS_SIZE / 2 + offsetX.value, CANVAS_SIZE / 2 + offsetY.value)
  context.rotate((rotation.value * Math.PI) / 180)
  context.scale(scale.value * flipX.value, scale.value * flipY.value)

  const baseScale = Math.max(
    CANVAS_SIZE / imageElement.width,
    CANVAS_SIZE / imageElement.height,
  )
  const drawWidth = imageElement.width * baseScale
  const drawHeight = imageElement.height * baseScale

  context.drawImage(
    imageElement,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  )
  context.restore()
}

function loadImage() {
  if (!props.sourceUrl) {
    imageLoaded.value = false
    return
  }

  imageLoaded.value = false
  resetEditor()
  imageElement.src = props.sourceUrl
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

async function handleConfirm() {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

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
    if (visible) {
      await nextTick()
      loadImage()
    }
  },
  { immediate: true },
)

watch(
  () => props.sourceUrl,
  () => {
    if (props.show) {
      loadImage()
    }
  },
)

watch([scale, rotation, offsetX, offsetY, flipX, flipY], () => {
  drawCanvas()
})

imageElement.onload = () => {
  imageLoaded.value = true
  drawCanvas()
}

onBeforeUnmount(() => {
  imageElement.onload = null
})
</script>

<style scoped>
.avatar-editor {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.95fr);
  gap: 24px;
  align-items: start;
}

.avatar-editor__panel {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.92));
  padding: 18px;
}

.avatar-editor__source {
  overflow: hidden;
  border-radius: 14px;
  background:
    linear-gradient(90deg, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
    linear-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px);
  background-size: 24px 24px;
  background-color: white;
  border: 1px solid rgba(148, 163, 184, 0.28);
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}

.avatar-editor__source-image {
  display: block;
  max-width: 100%;
  max-height: 260px;
  object-fit: contain;
}

.avatar-editor__control-group {
  margin-bottom: 16px;
}

.avatar-editor__label {
  display: block;
  margin-bottom: 8px;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}

.avatar-editor__preview-header {
  margin-bottom: 12px;
  color: #0f172a;
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
  border: 1px solid rgba(148, 163, 184, 0.3);
  background:
    linear-gradient(90deg, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
    linear-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px);
  background-size: 24px 24px;
  background-color: white;
}

@media (max-width: 900px) {
  .avatar-editor {
    grid-template-columns: 1fr;
  }

  .avatar-editor__canvas {
    width: min(100%, 320px);
    height: auto;
    aspect-ratio: 1;
  }
}
</style>
