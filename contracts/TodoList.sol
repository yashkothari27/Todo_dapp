// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

contract TodoList {
    struct Todo {
        uint256 id;
        bytes32 content;
        address owner;
        bool isCompleted;
        uint256 timestamp;
    }

    uint256 public constant maxAmountOfTodos = 100;

    // Owner => todos
    mapping(address => Todo[]) private todos;

    // Events for frontend updates
    event TodoCreated(address indexed owner, uint256 id, bytes32 content, uint256 timestamp);
    event TodoCompleted(address indexed owner, uint256 id);
    event TodoDeleted(address indexed owner, uint256 id);

    modifier onlyOwner(uint256 _todoId) {
        require(_todoId < todos[msg.sender].length, "Invalid todo ID");
        require(todos[msg.sender][_todoId].owner == msg.sender, "Not the owner");
        _;
    }

    // Add a todo to the list
    function addTodo(bytes32 _content) public {
        require(_content.length > 0, "Content cannot be empty");
        require(todos[msg.sender].length < maxAmountOfTodos, "Todo list is full");

        uint256 newTodoId = todos[msg.sender].length;

        todos[msg.sender].push(
            Todo({
                id: newTodoId,
                content: _content,
                owner: msg.sender,
                isCompleted: false,
                timestamp: block.timestamp
            })
        );

        emit TodoCreated(msg.sender, newTodoId, _content, block.timestamp);
    }

    // Mark a todo as completed
    function markTodoAsCompleted(uint256 _todoId) public onlyOwner(_todoId) {
        require(!todos[msg.sender][_todoId].isCompleted, "Todo already completed");

        todos[msg.sender][_todoId].isCompleted = true;

        emit TodoCompleted(msg.sender, _todoId);
    }

    // Delete a todo
    function deleteTodo(uint256 _todoId) public onlyOwner(_todoId) {
        require(_todoId < todos[msg.sender].length, "Invalid todo ID");

        // Shift the last element into the deleted slot to maintain continuity
        todos[msg.sender][_todoId] = todos[msg.sender][todos[msg.sender].length - 1];
        todos[msg.sender][_todoId].id = _todoId;

        // Remove the last element
        todos[msg.sender].pop();

        emit TodoDeleted(msg.sender, _todoId);
    }

    // Get all todos for the sender
    function getTodos() public view returns (Todo[] memory) {
        return todos[msg.sender];
    }

    // Get the number of todos for the sender
    function getTodoCount() public view returns (uint256) {
        return todos[msg.sender].length;
    }

    // Get active (incomplete) todos for the sender
    function getActiveTodos() public view returns (Todo[] memory) {
        uint256 activeCount = 0;

        // Count active todos
        for (uint256 i = 0; i < todos[msg.sender].length; i++) {
            if (!todos[msg.sender][i].isCompleted) {
                activeCount++;
            }
        }

        // Create an array of active todos
        Todo[] memory activeTodos = new Todo[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < todos[msg.sender].length; i++) {
            if (!todos[msg.sender][i].isCompleted) {
                activeTodos[index] = todos[msg.sender][i];
                index++;
            }
        }

        return activeTodos;
    }
}
