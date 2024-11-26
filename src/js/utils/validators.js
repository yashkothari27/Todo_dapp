const Validators = {
    validateTodoContent: function(content) {
        if (!content) {
            throw new Error('Content cannot be empty');
        }
        
        if (content.trim().length === 0) {
            throw new Error('Content cannot be only whitespace');
        }
        
        if (content.length > 32) {
            throw new Error('Content must be 32 characters or less');
        }
        
        // Check for special characters that might cause issues
        const specialChars = /[^\x20-\x7E]/;
        if (specialChars.test(content)) {
            throw new Error('Content contains invalid characters');
        }
        
        return true;
    }
}; 