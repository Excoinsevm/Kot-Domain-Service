import { useEffect, useState } from 'react';
import './styles.css';
import { ethers } from 'ethers';

import contractAbi from './utils/contractABI';
import { networks } from './utils/networks';
import { ReactComponent as Coder } from './assets/coder.svg';
import { ReactComponent as PolygonIcon } from './assets/polygon.svg';
import { ReactComponent as EthIcon } from './assets/ethereum.svg';

const TWITTER_HANDLE = 'kharioki';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;

// domain to mint
const tld = '.trigon';
const CONTRACT_ADDRESS = '0xa1c575342591f6d8fc79a26cBaDDc8485ca8eE52';

function App() {
  const [currentAccount, setCurrentAccount] = useState('');
  const [domain, setDomain] = useState('');
  const [record, setRecord] = useState('');
  const [network, setNetwork] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mints, setMints] = useState([]);

  const connectWallet = async () => {
    try {
      const provider = window.ethereum;

      if (!provider) {
        alert('Please install MetaMask -> https://metamask.io/');
        return;
      }
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      console.log('Connected to MetaMask', accounts);
      setCurrentAccount(accounts[0]);
    } catch (error) {
      console.log(error);
    }
  };

  const switchNetwork = async () => {
    if (window.ethereum) {
      try {
        // Try to switch to the Trigon network
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x3a1' }], // Check networks.js for hexadecimal network ids
        });
      } catch (error) {
        // This error code means that the chain we want has not been added to MetaMask
        // In this case we ask the user to add it to their MetaMask
        if (error.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x3a1',
                  chainName: 'Trigon',
                  rpcUrls: ['https://929.rpc.thirdweb.com/'],
                  nativeCurrency: {
                    name: "Trigon",
                    symbol: "TRI",
                    decimals: 18
                  },
                  blockExplorerUrls: ["https://explorer-trigon-52af1phymr.t.conduit.xyz/"]
                },
              ],
            });
          } catch (error) {
            console.log(error);
          }
        }
        console.log(error);
      }
    } else {
      alert('MetaMask is not installed. Please install it to use this app: https://metamask.io/download.html');
    }
  }

  const checkIfWalletIsConnected = async () => {
    const { ethereum } = window;

    if (!ethereum) {
      console.log('Make sure metamask is installed');
      return;
    } else {
      console.log('We have the ethereum object');
    }

    // Check if we're authorized to access the user's wallet
    const accounts = await ethereum.request({ method: 'eth_accounts' });

    if (accounts.length !== 0) {
      const account = accounts[0];
      console.log('Found an authorized account: ', account);
      setCurrentAccount(account);
    } else {
      console.log('No authorized accounts found');
    }

    const chainId = await ethereum.request({ method: 'eth_chainId' });
    setNetwork(networks[chainId]);

    ethereum.on('chainChanged', handleChainChanged);

    function handleChainChanged(_chainId) {
      window.location.reload();
    };
  }

  const fetchMints = async () => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        // You know all this
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);

        // Get all the domain names from our contract
        const names = await contract.getAllNames();

        // For each name, get the record and the address
        const mintRecords = await Promise.all(names.map(async (name) => {
          const mintRecord = await contract.records(name);
          const owner = await contract.domains(name);
          return {
            id: names.indexOf(name),
            name: name,
            record: mintRecord,
            owner: owner,
          };
        }));

        console.log("MINTS FETCHED ", mintRecords);
        setMints(mintRecords);
      }
    } catch (error) {
      console.log(error);
    }
  }

  const mintDomain = async () => {
    // Don't run if domain is empty
    if (!domain) { return }
    // Alert user if domain is too short
    if (domain.length < 3) {
      alert('Domain is too short. Must be at least 3 characters long');
      return;
    }

    setLoading(true);

    // Calculate price based on length of domain: 3chars = 0.5 MATIC ? 4chars = 0.3 : 0.1, etc
    const price = domain.length === 3 ? '0.5' : domain.length === 4 ? '0.3' : '0.1';
    console.log('Minting domain ', domain, 'with price ', price);

    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);

        console.log('Pop wallet to pay gas...');
        let tx = await contract.register(domain, { value: ethers.utils.parseEther(price) });
        // wait for the transaction to be minted
        const receipt = await tx.wait();
        // check if transaction was successful
        if (receipt.status === 1) {
          console.log('Domain minted successfully! https://explorer-trigon-52af1phymr.t.conduit.xyz/tx/' + tx.hash);

          // Set the record for the domain
          tx = await contract.setRecord(domain, record);
          await tx.wait();

          console.log('Record set! https://explorer-trigon-52af1phymr.t.conduit.xyz/tx/' + tx.hash);

          setTimeout(() => {
            fetchMints();
          }, 1000);

          setLoading(false);
          setRecord('');
          setDomain('');
        } else {
          alert('Domain minting failed. Please try again.');
          setLoading(false);
        }
      }
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  }

  const updateDomain = async () => {
    if (!record || !domain) { return }
    setLoading(true);
    console.log("Updating domain", domain, "with record", record);
    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);

        let tx = await contract.setRecord(domain, record);
        await tx.wait();
        console.log("Record set https://explorer-trigon-52af1phymr.t.conduit.xyz/tx/" + tx.hash);

        fetchMints();
        setRecord('');
        setDomain('');
        setEditing(false);
      }
    } catch (error) {
      console.log(error);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (network === 'Polygon Mumbai Testnet') {
      fetchMints();
    }
  }, [currentAccount, network]);

  const renderConnectWalletButton = () => (
    <div className="flex justify-center">
      <button
        className="flex items-center px-4 mx-8 my-4 rounded-md border-2 border-purple-500 py-2 dark:text-white hover:text-white hover:bg-purple-500"
        onClick={connectWallet}>
        Connect Wallet
      </button>
    </div>
  );

  const renderInput = () => {
    if (network !== 'Polygon Mumbai Testnet') {
      return (
        <div className="flex flex-col items-center justify-center">
          <p className="text-purple-500 text-md font-bold right-4 mx-4">
            Please connect to the Trigon Blockchain
          </p>
          <button
            className="flex items-center px-2 mx-2 my-2 rounded-md border-2 border-purple-500 py-2 text-purple-500 hover:text-white hover:bg-purple-700"
            onClick={switchNetwork}>
            Click here to switch
          </button>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center px-4">
        <div className="flex relative mx-auto w-full md:w-3/4 lg:w-1/2 items-center">
          <input
            className="w-full px-4 py-2 my-4 mx-4 text-xs sm:text-sm focus:outline-none rounded-md border-2 border-purple-500 dark:border-gray-900 dark:text-gray-400 dark:bg-gray-900"
            type="text"
            placeholder="Domain name (min 3 characters)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <input
            className="w-full px-4 py-2 my-4 mx-4 text-xs sm:text-sm focus:outline-none rounded-md border-2 border-purple-500 dark:border-gray-900 dark:text-gray-400 dark:bg-gray-900"
            type="text"
            placeholder="Set record (Optional)"
            value={record}
            onChange={(e) => setRecord(e.target.value)}
          />
          <div className="flex justify-center">
            {loading ? (
              <button
                className="flex items-center px-4 mx-8 my-4 rounded-md border-2 border-purple-500 py-2 dark:text-white hover:bg-purple-500 cursor-not-allowed"
                disabled>
                Loading...
              </button>
            ) : (
              <button
                className="flex items-center px-4 mx-8 my-4 rounded-md border-2 border-purple-500 py-2 dark:text-white hover:bg-purple-500"
                onClick={editing ? updateDomain : mintDomain}>
                {editing ? 'Update Domain' : 'Mint Domain'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMints = () => {
    return (
      <div className="flex flex-col items-center justify-center mx-auto">
        <h2 className="text-purple-500 font-semibold text-xl mb-4">Your Mints</h2>
        {mints.length === 0 ? (
          <p className="text-purple-500 text-md">No domains minted yet.</p>
        ) : (
          <ul className="flex flex-wrap justify-center">
            {mints.map((mint, index) => (
              <li key={index} className="my-4 mx-6 flex flex-col items-center">
                <div className="p-4 rounded-lg border-2 border-gray-300 dark:border-gray-600">
                  <h3 className="text-xl font-semibold text-center">{mint.name}</h3>
                  <p className="text-md text-center">{mint.record}</p>
                  <p className="text-sm text-center mt-2">
                    Owned by: {mint.owner.slice(0, 6)}...{mint.owner.slice(-4)}
                  </p>
                  <button
                    className="text-purple-500 mt-4"
                    onClick={() => {
                      setEditing(true);
                      setDomain(mint.name);
                      setRecord(mint.record);
                    }}>
                    Edit Record
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="App flex flex-col items-center justify-center h-screen bg-gray-100 dark:bg-gray-900 dark:text-white">
      <div className="flex items-center justify-center my-6">
        <h1 className="text-4xl font-semibold text-center text-purple-500">
          Trigon Domain Manager
        </h1>
        <a
          className="text-purple-500 text-md ml-4"
          href={TWITTER_LINK}
          target="_blank"
          rel="noreferrer">
          @{TWITTER_HANDLE}
        </a>
      </div>
      {currentAccount ? (
        <div className="flex flex-col items-center justify-center">
          <p className="text-sm text-center mb-4">Connected to: {currentAccount.slice(0, 6)}...{currentAccount.slice(-4)}</p>
          {renderInput()}
          {renderMints()}
        </div>
      ) : (
        renderConnectWalletButton()
      )}
    </div>
  );
}

export default App;
