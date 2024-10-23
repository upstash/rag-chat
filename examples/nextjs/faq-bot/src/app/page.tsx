"use client";
import React, { useState } from "react";

const Home: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [response, setResponse] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      handleUpload(selectedFile); 
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
  
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
  
      if (!res.ok) throw new Error("Error during file upload");
  
      const data = await res.json();
      console.log(data);
      alert("File uploaded successfully");
    } catch (error) {
      console.error(error);
      alert("An error occurred during file upload.");
    }
  }; 

  const handleChat = async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ content: query }],
          sessionId: "optional-session-id" 
        }),
      });
  
      if (!res.ok) throw new Error("Error during chat request");
  
      const data = await res.json();
      setResponse(data.response);
    } catch (error) {
      console.error(error);
      setResponse("An error occurred while fetching the response.");
    }
  };
  
  
  return (
    <div className="bg-[#212121] h-screen">
      <div className="p-5 max-w-lg mx-auto">
        <h1 className="text-xl font-semibold mb-4">PDF-Based FAQ Bot</h1>
        <div className="relative mb-2">
          <input
            type="file"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <button className="bg-zinc-500 text-white py-2 px-4 w-full rounded hover:bg-zinc-600">
            Upload PDF
          </button>
        </div>

        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question..."
          rows={2}
          className="w-full p-2 border border-gray-300 rounded mb-2 bg-[#212121] text-white"
        />
        <button
          onClick={handleChat}
          className="bg-zinc-500 text-white py-1 px-4 rounded hover:bg-zinc-600"
        >
          Send
        </button>
        {response && (
          <div className="mt-5 whitespace-pre-wrap">
            <h2 className="text-xl font-semibold mb-2">Response:</h2>
            <p>{response}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
