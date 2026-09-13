<script setup lang="ts">
import { useWorkspace } from '~/composables/useWorkspace'

const { snapshot, login, debugOpen, error } = useWorkspace()
const busy = ref(false)

async function submit() {
  busy.value = true
  try {
    await login()
  }
  finally {
    busy.value = false
  }
}

async function enterDebug() {
  busy.value = true
  try {
    await debugOpen()
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh flex items-center justify-center bg-background">
    <div class="w-full max-w-sm px-8">
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 bg-primary text-primary-foreground">
          <UIcon name="i-lucide-pen-tool" class="w-8 h-8" />
        </div>
        <h1 class="text-2xl font-semibold tracking-tight">
          unote
        </h1>
        <p class="mt-2 text-sm text-muted-foreground">
          本地优先的 Markdown 笔记，Git 云端同步
        </p>
      </div>

      <UButton block size="lg" :loading="busy" @click="submit">
        <template v-if="!busy" #leading>
          <UIcon name="i-lucide-github" class="w-4 h-4" />
        </template>
        {{ busy ? '正在授权…' : '使用 Gitee 登录' }}
      </UButton>

      <UAlert v-if="error" color="error" :title="error" class="mt-4" />

      <UButton v-if="snapshot?.isDebugBuild" variant="ghost" block class="mt-4" @click="enterDebug">
        进入本地调试模式
      </UButton>

      <p class="mt-8 text-xs text-center text-muted">
        登录后将自动在 Gitee 创建私有仓库用于同步
      </p>
    </div>
  </div>
</template>
