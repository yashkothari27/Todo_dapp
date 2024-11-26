const App = {
    web3: null,
    contract: null,
    account: null,
    networks: {
        43113: {
            name: 'Avalanche Fuji Testnet',
            chainId: '0xA869',
            contractAddress: '0xA89072A3093A5128685C017f2c855C5Ed9D24D6d',
            params: {
                chainId: '0xA869',
                chainName: 'Avalanche Fuji Testnet',
                nativeCurrency: {
                    name: 'AVAX',
                    symbol: 'AVAX',
                    decimals: 18
                },
                rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
                blockExplorerUrls: ['https://testnet.snowtrace.io/']
            }
        },
        32323: {
            name: 'RTC Mainnet',
            chainId: '0x7E43',
            contractAddress: '0x00057425Af8DC24D3070284850629Fde76B85D26',
            params: {
                chainId: '0x7E43',
                chainName: 'RTC Mainnet',
                nativeCurrency: {
                    name: 'RTC',
                    symbol: 'RTC',
                    decimals: 18
                },
                rpcUrls: ['https://mainnet.reltime.com'],
                blockExplorerUrls: ['https://explorer.reltime.com']
            }
        }
    },

    init: async function() {
        try {
            // Check if MetaMask is installed
            if (typeof window.ethereum === 'undefined') {
                throw new Error('Please install MetaMask to use this DApp');
            }

            App.web3 = new Web3(window.ethereum);
            
            // Set up event listeners
            window.ethereum.on('chainChanged', App.handleChainChange);
            window.ethereum.on('accountsChanged', App.handleAccountChange);
            
            // Check if already connected
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await App.handleAccountChange(accounts);
            }

            // Set up connect wallet button handler
            $('#connectWallet').on('click', App.connectWallet);
            
            // Set up network select handler
            $('#networkSelect').on('change', App.switchNetwork);
            
            // Set up todo creation handler
            $('#createTodo').on('click', App.createTodo);
            
            // Set up filter handlers
            $('.filter-btn').on('click', function() {
                $('.filter-btn').removeClass('active');
                $(this).addClass('active');
                App.filterTodos($(this).data('filter'));
            });

        } catch (error) {
            console.error('Initialization error:', error);
            App.showStatus('Failed to initialize app: ' + error.message, 'error');
        }
    },

    switchNetwork: async function() {
        try {
            const networkId = $('#networkSelect').val();
            const network = App.networks[networkId];
            
            if (!network) {
                throw new Error('Network configuration not found');
            }

            App.showLoading('Switching Network...');
            console.log('Switching to network:', network);

            try {
                // First try to switch to the network
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: network.chainId }]
                });
            } catch (switchError) {
                console.log('Switch error:', switchError);
                
                // Check if the error is due to the chain not being added
                if (switchError.code === 4902 || switchError.code === -32603) {
                    try {
                        console.log('Adding network with params:', network.params);
                        
                        // Add the network to MetaMask
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [network.params]
                        });
                    } catch (addError) {
                        console.error('Add network error:', addError);
                        throw new Error(`Failed to add network: ${addError.message}`);
                    }
                } else {
                    throw switchError;
                }
            }

            // Wait for network change to be confirmed
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update UI
            $('#network').text(network.name);
            
            // Reinitialize contract with new network
            await App.initContract();
            if (App.account) {
                await App.loadTodos();
            }
            
            App.showStatus(`Successfully switched to ${network.name}`, 'success');
        } catch (error) {
            console.error('Network switch error:', error);
            App.showStatus(`Failed to switch network: ${error.message}`, 'error');
        } finally {
            App.hideLoading();
        }
    },

    updateStats: async function() {
        try {
            if (!App.contract || !App.account) return;
            const todos = await App.contract.methods.getTodos().call({ from: App.account });
            const completed = todos.filter(todo => todo.isCompleted).length;
            
            $('#totalTasks').text(todos.length);
            $('#completedTasks').text(completed);
            $('#pendingTasks').text(todos.length - completed);
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    },

    showLoading: function(message = 'Processing Transaction...') {
        $('#loading-text').text(message);
        $('#loading-overlay').css('display', 'flex');
    },

    hideLoading: function() {
        $('#loading-overlay').hide();
    },

    showStatus: function(message, type) {
        const statusDiv = $('#status-message');
        statusDiv.removeClass().addClass(type).html(message).show();
        setTimeout(() => statusDiv.fadeOut(), 3000);
    },

    handleChainChange: async function(chainId) {
        try {
            const networkId = parseInt(chainId, 16);
            const network = App.networks[networkId];
            
            // Unsubscribe from old events
            if (App.contract) {
                App.contract.events.allEvents().unsubscribe();
            }
            
            if (network) {
                $('#network').text(network.name);
                $('#networkSelect').val(networkId);
            } else {
                $('#network').text('Unsupported Network');
            }
            
            // Reinitialize contract with new events
            await App.initContract();
            
            // Reload todos if account is connected
            if (App.account) {
                await App.loadTodos();
                await App.updateStats();
            }
        } catch (error) {
            console.error('Chain change error:', error);
            $('#network').text('Not Connected');
        }
    },

    connectWallet: async function() {
        try {
            App.showLoading('Connecting wallet...');
            
            // Request accounts access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
            
            if (accounts.length === 0) {
                throw new Error('No accounts found');
            }

            // Update account and UI
            App.account = accounts[0];
            $('#account').text(App.account.substring(0, 6) + '...' + App.account.substring(38));
            $('#connectWallet').text('Connected').addClass('connected');
            $('#content').show();

            // Get and display current network
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            await App.handleChainChange(chainId);
            
            // Initialize contract
            const success = await App.initContract();
            if (success) {
                await App.loadTodos();
                await App.updateStats();
            }

            App.showStatus('Wallet connected successfully', 'success');
        } catch (error) {
            console.error('Connection error:', error);
            App.showStatus('Failed to connect wallet: ' + error.message, 'error');
            $('#network').text('Not Connected');
        } finally {
            App.hideLoading();
        }
    },

    handleAccountChange: async function(accounts) {
        try {
            if (accounts.length === 0) {
                // Unsubscribe from events when disconnecting
                if (App.contract) {
                    App.contract.events.allEvents().unsubscribe();
                }
                App.account = null;
                $('#account').text('Not Connected');
                $('#content').hide();
                return;
            }

            App.account = accounts[0];
            $('#account').text(App.account.substring(0, 6) + '...' + App.account.substring(38));
            $('#connectWallet').text('Connected').addClass('connected');
            $('#content').show();

            // Initialize contract and set up events for new account
            const success = await App.initContract();
            if (success) {
                await App.loadTodos();
                await App.updateStats();
            }
        } catch (error) {
            console.error('Account change error:', error);
            App.showStatus('Failed to handle account change', 'error');
        }
    },

    initContract: async function() {
        try {
            const networkId = await window.ethereum.request({ method: 'eth_chainId' });
            const currentNetwork = parseInt(networkId, 16);
            
            if (!App.networks[currentNetwork]) {
                throw new Error('Please connect to a supported network');
            }

            const contractAddress = App.networks[currentNetwork].contractAddress;
            const response = await fetch('abis/TodoList.json');
            const todoListAbi = await response.json();
            
            App.contract = new App.web3.eth.Contract(
                todoListAbi,
                contractAddress
            );
            
            // Set up event listeners for contract events
            App.setupContractEvents();
            
            return true;
        } catch (error) {
            console.error('Contract initialization error:', error);
            App.showStatus('Failed to initialize contract', 'error');
            return false;
        }
    },

    createTodo: async function(e) {
        e.preventDefault();
        const content = $('#todo-input').val().trim();
        
        if (!content) {
            App.showStatus('Please enter a todo', 'error');
            return;
        }

        try {
            App.showLoading('Creating todo...');
            
            if (!App.contract) {
                throw new Error(ErrorHandler.ERRORS.CONTRACT_ERROR);
            }

            if (!App.account) {
                throw new Error(ErrorHandler.ERRORS.WALLET_CONNECTION_ERROR);
            }

            // Validate content length
            if (content.length > 32) {
                throw new Error('Todo content must be 32 characters or less');
            }

            const contentBytes = App.web3.utils.asciiToHex(content);
            
            // Get gas estimate first
            const gasEstimate = await App.contract.methods.addTodo(contentBytes)
                .estimateGas({ from: App.account });

            // Add 20% buffer to gas estimate
            const gas = Math.ceil(gasEstimate * 1.2);

            const transaction = await App.contract.methods.addTodo(contentBytes).send({
                from: App.account,
                gas: gas
            });

            // Verify transaction success
            if (!transaction.status) {
                throw new Error('Transaction failed');
            }

            $('#todo-input').val('');
            App.showStatus('Todo created successfully!', 'success');
            
            // Wait for blockchain confirmation
            await App.web3.eth.getTransactionReceipt(transaction.transactionHash);
            
            await App.loadTodos();
            await App.updateStats();
        } catch (error) {
            console.error('Error creating todo:', error);
            App.showStatus(ErrorHandler.handle(error, 'Failed to create todo'), 'error');
        } finally {
            App.hideLoading();
        }
    },

    loadTodos: async function() {
        try {
            const todos = await App.contract.methods.getTodos().call({ from: App.account });
            const todosList = $('#todos-list');
            todosList.empty();

            todos.forEach(todo => {
                const content = App.web3.utils.hexToAscii(todo.content).replace(/\0/g, '');
                const timestamp = new Date(todo.timestamp * 1000);
                const formattedDate = timestamp.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const html = `
                    <div class="todo-item ${todo.isCompleted ? 'completed' : ''}" data-id="${todo.id}">
                        <div class="todo-content">
                            <h3 class="todo-title">${content}</h3>
                            <span class="todo-timestamp">
                                <i class="fas fa-clock"></i> ${formattedDate}
                            </span>
                        </div>
                        <div class="todo-actions">
                            ${!todo.isCompleted ? `
                                <button onclick="App.completeTodo(${todo.id})" class="todo-button complete-button">
                                    <i class="fas fa-check"></i> Complete
                                </button>
                            ` : `
                                <span class="completed-badge">
                                    <i class="fas fa-check-circle"></i> Completed
                                </span>
                            `}
                            <button onclick="App.deleteTodo(${todo.id})" class="todo-button delete-button">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
                todosList.append(html);
            });
        } catch (error) {
            console.error('Error loading todos:', error);
            App.showStatus('Failed to load todos', 'error');
        }
    },

    completeTodo: async function(id) {
        try {
            App.showStatus('Completing todo...', 'info');
            await App.contract.methods.markTodoAsCompleted(id).send({
                from: App.account,
                gas: 100000
            });
            App.showStatus('Todo completed successfully!', 'success');
            await App.loadTodos();
        } catch (error) {
            console.error('Error completing todo:', error);
            App.showStatus('Failed to complete todo', 'error');
        }
    },

    getNetworkName: function(networkId) {
        const networks = {
            1: 'Ethereum Mainnet',
            5: 'Goerli Testnet',
            11155111: 'Sepolia Testnet',
            137: 'Polygon Mainnet',
            80001: 'Mumbai Testnet'
        };
        return networks[networkId] || `Network ID: ${networkId}`;
    },

    filterTodos: function(filter) {
        $('.todo-item').each(function() {
            const isCompleted = $(this).hasClass('completed');
            if (filter === 'all' || 
                (filter === 'active' && !isCompleted) || 
                (filter === 'completed' && isCompleted)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    },

    // Add new network monitoring functionality
    networkMonitor: {
        checkInterval: null,
        
        start: function() {
            this.checkInterval = setInterval(async () => {
                try {
                    const isConnected = await window.ethereum.isConnected();
                    if (!isConnected) {
                        App.showStatus('Network connection lost', 'error');
                        this.stop();
                        return;
                    }

                    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                    const networkId = parseInt(chainId, 16);
                    
                    if (!App.networks[networkId]) {
                        App.showStatus('Please switch to a supported network', 'warning');
                    }
                } catch (error) {
                    console.error('Network monitoring error:', error);
                }
            }, 5000);
        },

        stop: function() {
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
        }
    },

    deleteTodo: async function(id) {
        try {
            App.showLoading('Deleting todo...');
            
            if (!App.contract) {
                throw new Error(ErrorHandler.ERRORS.CONTRACT_ERROR);
            }

            if (!App.account) {
                throw new Error(ErrorHandler.ERRORS.WALLET_CONNECTION_ERROR);
            }

            // Get gas estimate first
            const gasEstimate = await App.contract.methods.deleteTodo(id)
                .estimateGas({ from: App.account });

            // Add 20% buffer to gas estimate
            const gas = Math.ceil(gasEstimate * 1.2);

            const transaction = await App.contract.methods.deleteTodo(id).send({
                from: App.account,
                gas: gas
            });

            // Verify transaction success
            if (!transaction.status) {
                throw new Error('Transaction failed');
            }

            App.showStatus('Todo deleted successfully!', 'success');
            
            // Wait for blockchain confirmation
            await App.web3.eth.getTransactionReceipt(transaction.transactionHash);
            
            // Refresh the todo list and stats
            await App.loadTodos();
            await App.updateStats();
        } catch (error) {
            console.error('Error deleting todo:', error);
            App.showStatus(ErrorHandler.handle(error, 'Failed to delete todo'), 'error');
        } finally {
            App.hideLoading();
        }
    },

    setupContractEvents: function() {
        if (!App.contract) return;

        // Subscribe to TodoCreated events
        App.contract.events.TodoCreated({
            filter: { owner: App.account }
        })
        .on('data', async function(event) {
            await App.loadTodos();
            await App.updateStats();
            App.showStatus('New todo created!', 'success');
        })
        .on('error', console.error);

        // Subscribe to TodoCompleted events
        App.contract.events.TodoCompleted({
            filter: { owner: App.account }
        })
        .on('data', async function(event) {
            await App.loadTodos();
            await App.updateStats();
            App.showStatus('Todo completed!', 'success');
        })
        .on('error', console.error);

        // Subscribe to TodoDeleted events
        App.contract.events.TodoDeleted({
            filter: { owner: App.account }
        })
        .on('data', async function(event) {
            await App.loadTodos();
            await App.updateStats();
            App.showStatus('Todo deleted!', 'success');
        })
        .on('error', console.error);
    },

    // Add this helper function to verify network connection
    verifyNetworkConnection: async function(networkId) {
        try {
            const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
            const currentNetworkId = parseInt(currentChainId, 16).toString();
            return currentNetworkId === networkId.toString();
        } catch (error) {
            console.error('Network verification error:', error);
            return false;
        }
    },

    // Helper function to convert decimal to hex chainId
    toHex: function(num) {
        return '0x' + Number(num).toString(16);
    }
};

// Add a new error handling utility
const ErrorHandler = {
    ERRORS: {
        METAMASK_NOT_INSTALLED: 'MetaMask is not installed',
        NETWORK_ERROR: 'Network connection error',
        CONTRACT_ERROR: 'Smart contract interaction failed',
        WALLET_CONNECTION_ERROR: 'Failed to connect wallet',
        INVALID_NETWORK: 'Please connect to a supported network',
        TRANSACTION_ERROR: 'Transaction failed',
        USER_REJECTED: 'User rejected the transaction'
    },

    handle: function(error, defaultMessage = 'An error occurred') {
        console.error('Error:', error);
        
        // MetaMask specific error handling
        if (error.code) {
            switch (error.code) {
                case 4001:
                    return 'Transaction rejected by user';
                case 4902:
                    return 'Network not added to MetaMask';
                case -32002:
                    return 'MetaMask is already processing a request';
                case -32603:
                    return 'Internal JSON-RPC error';
            }
        }

        // Check if error is a string
        if (typeof error === 'string') {
            return error;
        }

        // Return error message or default message
        return error.message || defaultMessage;
    }
};

$(document).ready(function() {
    App.init();
});