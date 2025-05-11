const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const uploadButton = document.getElementById('uploadButton');
const imageInput = document.getElementById('imageInput');

uploadButton.addEventListener('click', () => {
    imageInput.click();
});
imageInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        await uploadFile(file);
    }
});
messagesContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    messagesContainer.style.backgroundColor = '#f0f0f0';
});
messagesContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    messagesContainer.style.backgroundColor = '';
});
messagesContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    messagesContainer.style.backgroundColor = '';
    const file = e.dataTransfer.files[0];
    if (file) {
        await uploadFile(file);
    }
});
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch('https://chatlink.space/api/internalusercontent/upload', {
            method: 'POST',
            body: formData
        });
        if (response.ok) {
            const data = await response.json();
            if (data.link) {
                const currentText = messageInput.value;
                const textToInsert = data.link;
                messageInput.value = currentText + textToInsert;
            }
            console.log('up');
        } else {
            console.error('failed up', response.statusText);
        }
    } catch (error) {
        console.error('up err', error);
    }
}
