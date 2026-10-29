// Ensure this matches your llama-server port
const LLM_API_URL = "http://localhost:5000/v1/chat/completions";

const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const previewContainer = document.getElementById("previewContainer");
const imageForm = document.getElementById("imageForm");
const submitButton = document.getElementById("submitButton");
const loadingMessage = document.getElementById("loadingMessage");
const errorElem = document.getElementById("error");
const resultContainer = document.getElementById("resultContainer");
const aiOutput = document.getElementById("aiOutput");

let currentImageBase64 = null;

// Handle image selection and preview
imageInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    errorElem.textContent = "";
    errorElem.style.display = "none";
    resultContainer.style.display = "none";

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // FileReader provides a data URL (Base64) ready for the API
            currentImageBase64 = e.target.result;
            imagePreview.src = currentImageBase64;
            previewContainer.style.display = "block";
            submitButton.disabled = false;
        };
        reader.readAsDataURL(file);
    } else {
        currentImageBase64 = null;
        previewContainer.style.display = "none";
        submitButton.disabled = true;
    }
});

// Handle form submission (sending to AI)
imageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentImageBase64 || submitButton.disabled) return;

    // UI Feedback: Processing state
    errorElem.textContent = "";
    errorElem.style.display = "none";
    resultContainer.style.display = "none";
    loadingMessage.style.display = "block";
    submitButton.disabled = true;

    try {
        // Payload structured for llama.cpp multimodal (vision) models
        const response = await fetch(LLM_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Describe this image in detail." },
                            { type: "image_url", image_url: { url: currentImageBase64 } }
                        ]
                    }
                ],
                stream: false
            }),
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const rawReply = data.choices?.[0]?.message?.content;
        
        if (typeof rawReply !== "string" || !rawReply.trim()) {
            throw new Error("The model returned an empty response.");
        }

        // UI Feedback: Success state
        aiOutput.textContent = rawReply.trim();
        resultContainer.style.display = "block";

    } catch (error) {
        console.error("Error communicating with model:", error);
        // UI Feedback: Error state
        errorElem.textContent = error.message || "Something went wrong. Check if llama-server is running.";
        errorElem.style.display = "block";
    } finally {
        // Reset loading state
        loadingMessage.style.display = "none";
        submitButton.disabled = false;
    }
});