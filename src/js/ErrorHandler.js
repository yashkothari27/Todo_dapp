const ErrorHandler = {
    ERRORS: {
        CONTRACT_ERROR: 'Smart contract not initialized',
        WALLET_CONNECTION_ERROR: 'Wallet not connected',
        NETWORK_ERROR: 'Network error',
        TRANSACTION_ERROR: 'Transaction failed'
    },

    handle: function(error, defaultMessage) {
        // Handle MetaMask errors
        if (error.code === 4001) {
            return 'Transaction rejected by user';
        }

        // Handle contract revert errors
        if (error.message.includes('revert')) {
            const revertMessage = error.message.match(/revert\s(.*)"/);
            return revertMessage ? revertMessage[1] : 'Transaction reverted';
        }

        // Handle network errors
        if (error.message.includes('network')) {
            return 'Network error. Please check your connection';
        }

        // Handle known error types
        if (Object.values(this.ERRORS).includes(error.message)) {
            return error.message;
        }

        // Return default message if no specific handling
        return defaultMessage || 'An error occurred';
    }
}; 