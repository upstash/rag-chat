<script setup lang="ts">
import { ref } from "vue";
import { useChat } from "@ai-sdk/vue";

const { messages, input, handleSubmit } = useChat();
const loading = ref(false);

const handleAddData = async () => {
  loading.value = true;
  try {
    await fetch("/api/add-data", { method: "POST" });
  } catch (error) {
    console.error("Error adding data:", error);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col w-full max-w-md py-24 mx-auto stretch">
    <div v-for="m in messages" :key="m.id" class="whitespace-pre-wrap">
      {{ m.role === "user" ? "User: " : "AI: " }}
      {{ m.content }}
    </div>

    <form @submit="handleSubmit">
      <input
        class="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
        v-model="input"
        placeholder="Say something..."
      />
    </form>

    <button
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full fixed bottom-0 right-5 p-2 mb-8"
      @click="handleAddData"
      :disabled="loading"
    >
      {{ loading ? "Loading..." : "Add some data about France" }}
    </button>
  </div>
</template>

<style>
.fixed {
  position: fixed;
}
.bottom-0 {
  bottom: 0;
}
.w-full {
  width: 100%;
}
.max-w-md {
  max-width: 28rem;
}
.p-2 {
  padding: 0.5rem;
}
.mb-8 {
  margin-bottom: 2rem;
}
.border {
  border-width: 1px;
}
.border-gray-300 {
  border-color: #d1d5db;
}
.rounded {
  border-radius: 0.25rem;
}
.shadow-xl {
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
.bg-blue-500 {
  background-color: #3b82f6;
}
.hover\:bg-blue-700:hover {
  background-color: #1d4ed8;
}
.text-white {
  color: white;
}
.font-bold {
  font-weight: bold;
}
.py-2 {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}
.px-4 {
  padding-left: 1rem;
  padding-right: 1rem;
}
.rounded-full {
  border-radius: 9999px;
}
.right-5 {
  right: 1.25rem;
}
.opacity-50 {
  opacity: 0.5;
}
.cursor-not-allowed {
  cursor: not-allowed;
}
</style>
