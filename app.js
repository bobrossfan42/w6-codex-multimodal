const LLM_API_URL = "http://localhost:5000/v1/chat/completions";

const imageInput = document.getElementById("imageInput");
const imageForm = document.getElementById("imageForm");
const previewGrid = document.getElementById("previewGrid");
const responseGrid = document.getElementById("responseGrid");
const submitButton = document.getElementById("submitButton");
const loadingMessage = document.getElementById("loadingMessage");
const errorElem = document.getElementById("error");

let selectedImages = [];

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        reader.readAsDataURL(file);
    });
}

function renderPreviews(images) {
    previewGrid.replaceChildren();
    for (let index = 0; index < 2; index += 1) {
        const card = document.createElement("div");
        card.className = "image-card";
        const heading = document.createElement("h3");
        heading.textContent = `Image ${index + 1}`;
        card.append(heading);

        if (images[index]) {
            const image = document.createElement("img");
            image.src = images[index].dataUrl;
            image.alt = `Preview of image ${index + 1}: ${images[index].file.name}`;
            card.append(image);
        } else {
            card.classList.add("empty-card");
            const placeholder = document.createElement("span");
            placeholder.textContent = "No image selected";
            card.append(placeholder);
        }
        previewGrid.append(card);
    }
}

function setResponse(index, message) {
    const output = responseGrid.children[index]?.querySelector("article");
    if (output) output.textContent = message;
}

imageInput.addEventListener("change", async () => {
    errorElem.textContent = "";
    errorElem.style.display = "none";
    const files = Array.from(imageInput.files || []);

    if (files.length > 2) {
        errorElem.textContent = "Please select no more than two images.";
        errorElem.style.display = "block";
        imageInput.value = "";
        selectedImages = [];
        renderPreviews(selectedImages);
        submitButton.disabled = true;
        return;
    }

    try {
        selectedImages = await Promise.all(files.map(async (file) => ({
            file,
            dataUrl: await readAsDataUrl(file),
        })));
        renderPreviews(selectedImages);
        submitButton.disabled = selectedImages.length === 0;
        for (let index = 0; index < 2; index += 1) {
            setResponse(index, selectedImages[index] ? "Ready to describe." : "Waiting for input...");
        }
    } catch (error) {
        selectedImages = [];
        renderPreviews(selectedImages);
        submitButton.disabled = true;
        errorElem.textContent = error.message;
        errorElem.style.display = "block";
    }
});

async function describeImage(image) {
    const response = await fetch(LLM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: "Describe this image in detail." },
                    { type: "image_url", image_url: { url: image.dataUrl } },
                ],
            }],
            stream: false,
        }),
    });
    if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
        throw new Error("The model returned an empty response.");
    }
    return reply.trim();
}

imageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (selectedImages.length === 0 || submitButton.disabled) return;

    errorElem.textContent = "";
    errorElem.style.display = "none";
    loadingMessage.style.display = "block";
    loadingMessage.textContent = "AI is processing the selected images...";
    submitButton.disabled = true;
    selectedImages.forEach((_, index) => setResponse(index, "Generating description..."));

    const results = await Promise.allSettled(selectedImages.map(describeImage));
    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            setResponse(index, result.value);
        } else {
            console.error(`Error describing image ${index + 1}:`, result.reason);
            setResponse(index, "Unable to generate a description.");
        }
    });

    const errors = results.filter((result) => result.status === "rejected");
    if (errors.length) {
        errorElem.textContent = errors.map((result) => result.reason.message || "Check that the local model server is running.").join(" ");
        errorElem.style.display = "block";
    }
    loadingMessage.style.display = "none";
    submitButton.disabled = false;
});
