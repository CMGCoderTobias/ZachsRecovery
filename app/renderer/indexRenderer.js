document.addEventListener('DOMContentLoaded', () => {
    // You can access Electron APIs exposed via preload
    window.electron.receiveMessage('some-event', (event, arg) => {
      console.log(arg); // This will be the data sent from the main process
    });
  
    // Sending data to the main process
    window.electron.sendMessage('some-event', 'Hello from Renderer');
  });
  