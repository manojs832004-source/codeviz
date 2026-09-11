let waitingForPrompt = null;

const sendCmd = () => {
    waitingForPrompt = () => {
        console.log("Triggered");
        // Keep waiting
        return;
    };
};

sendCmd();

const trigger = () => {
    if (waitingForPrompt) {
        console.log("Calling");
        waitingForPrompt();
    } else {
        console.log("It is null!");
    }
};

trigger();
trigger();
