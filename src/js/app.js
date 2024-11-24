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
            
            // Get current network immediately
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            await App.handleChainChange(chainId);

            // Set up event listeners
            window.ethereum.on('chainChanged', App.handleChainChange);
            window.ethereum.on('accountsChanged', App.handleAccountChange);

            // Check if already connected
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await App.handleAccountChange(accounts);
            }
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

            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: network.chainId }]
                });
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [network.params]
                        });
                    } catch (addError) {
                        throw new Error('Failed to add network to MetaMask');
                    }
                } else {
                    throw switchError;
                }
            }

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
            
            if (network) {
                $('#network').text(network.name);
                $('#networkSelect').val(networkId);
            } else {
                $('#network').text('Unsupported Network');
            }
            
            // Reinitialize contract
            await App.initContract();
            
            // Reload todos if account is connected
            if (App.account) {
                await App.loadTodos();
            }
        } catch (error) {
            console.error('Chain change error:', error);
            $('#network').text('Not Connected');
        }
    },

    connectWallet: async function() {
        try {
            App.showLoading('Connecting wallet...');
            
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
            
            // Get and display current network after connection
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            await App.handleChainChange(chainId);
            
            await App.handleAccountChange(accounts);
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
                App.account = null;
                $('#account').text('Not Connected');
                $('#content').hide();
                return;
            }

            App.account = accounts[0];
            $('#account').text(App.account.substring(0, 6) + '...' + App.account.substring(38));
            $('#connectWallet').text('Connected').addClass('connected');
            $('#content').show();

            // Initialize contract before loading todos
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
                throw new Error('Contract not initialized');
            }

            if (!App.account) {
                throw new Error('Please connect your wallet');
            }

            const contentBytes = App.web3.utils.asciiToHex(content);
            
            await App.contract.methods.addTodo(contentBytes).send({
                from: App.account,
                gas: 200000
            });

            $('#todo-input').val('');
            App.showStatus('Todo created successfully!', 'success');
            await App.loadTodos();
            await App.updateStats();
        } catch (error) {
            console.error('Error creating todo:', error);
            App.showStatus('Failed to create todo: ' + error.message, 'error');
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
                const html = `
                    <div class="todo-item ${todo.isCompleted ? 'completed' : ''}">
                        <p>${content}</p>
                        <p>Created: ${new Date(todo.timestamp * 1000).toLocaleString()}</p>
                        ${!todo.isCompleted ? 
                            `<button onclick="App.completeTodo(${todo.id})">Complete</button>` : 
                            '<span>✓ Completed</span>'}
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

    initWeb3: async function() {
        try {
            if (window.ethereum) {
                App.web3Provider = window.ethereum;
                await App.handleWalletConnection();
            } else {
                App.showStatus('Please install MetaMask!', 'error');
            }
        } catch (error) {
            console.error('Error initializing web3:', error);
            App.showStatus('Failed to initialize Web3', 'error');
        }
    },

    handleWalletConnection: async function() {
        try {
            // Check if already connected
            const accounts = await ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                App.account = accounts[0];
                App.updateUIForConnectedWallet();
            } else {
                App.updateUIForDisconnectedWallet();
            }

            // Setup connect button handler
            $('#connectWallet').click(async function() {
                try {
                    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                    App.account = accounts[0];
                    App.updateUIForConnectedWallet();
                    await App.initContract();
                    App.showStatus('Wallet connected successfully!', 'success');
                } catch (error) {
                    console.error('Error connecting wallet:', error);
                    App.showStatus('Failed to connect wallet', 'error');
                }
            });

            // Setup disconnect button handler
            $('#disconnectWallet').click(async function() {
                try {
                    App.account = null;
                    App.updateUIForDisconnectedWallet();
                    App.showStatus('Wallet disconnected successfully!', 'success');
                } catch (error) {
                    console.error('Error disconnecting wallet:', error);
                    App.showStatus('Failed to disconnect wallet', 'error');
                }
            });

            // Listen for account changes
            ethereum.on('accountsChanged', function(accounts) {
                if (accounts.length > 0) {
                    App.account = accounts[0];
                    App.updateUIForConnectedWallet();
                } else {
                    App.updateUIForDisconnectedWallet();
                }
            });
        } catch (error) {
            console.error('Error handling wallet connection:', error);
            App.showStatus('Error handling wallet connection', 'error');
        }
    },

    updateUIForConnectedWallet: function() {
        $('#connectWallet').hide();
        $('#disconnectWallet').show();
        $('#account').text(App.account.substring(0, 6) + '...' + App.account.substring(38));
        $('#content').show();
        App.loadTodos();
        App.updateStats();
    },

    updateUIForDisconnectedWallet: function() {
        $('#connectWallet').show();
        $('#disconnectWallet').hide();
        $('#account').text('Not Connected');
        $('#content').hide();
        $('#todos-list').empty();
        $('#totalTasks').text('0');
        $('#completedTasks').text('0');
        $('#pendingTasks').text('0');
    }
};

$(document).ready(function() {
    App.init();
    
    // Add network switch event listener
    $('#networkSelect').on('change', App.switchNetwork);
    
    // Add todo creation event listener
    $('#createTodo').on('click', App.createTodo);
    
    // Add filter event listeners
    $('.filter-btn').on('click', function() {
        $('.filter-btn').removeClass('active');
        $(this).addClass('active');
        App.filterTodos($(this).data('filter'));
    });
});