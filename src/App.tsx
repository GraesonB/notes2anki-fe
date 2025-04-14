import { Component, createSignal, For, Show, onMount, createEffect } from 'solid-js';
import styles from './App.module.css';

type AnkiCard = {
  front: string;
  back: string;
};

type AnkiResponse = {
  cards: AnkiCard[];
};

const TOKEN_KEY = 'doc2anki-auth-token';

const App: Component = () => {
  const [inputMethod, setInputMethod] = createSignal<'file' | 'text'>('file');
  const [textInput, setTextInput] = createSignal('');
  const [file, setFile] = createSignal<File | null>(null);
  const [cards, setCards] = createSignal<AnkiCard[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [token, setToken] = createSignal<string>('');
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [authLoading, setAuthLoading] = createSignal(true);
  const [authError, setAuthError] = createSignal('');

  // Apply dark theme to document and check authentication
  onMount(async () => {
    document.documentElement.classList.add('dark');
    
    // Check if token exists in localStorage
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      // Validate the token
      await validateToken(savedToken);
    } else {
      setAuthLoading(false);
    }
  });

  const validateToken = async (tokenToValidate: string) => {
    setAuthLoading(true);
    setAuthError('');
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/v1/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenToValidate}`
        }
      });
      
      if (response.ok) {
        // If validation is successful, save token and set authenticated
        localStorage.setItem(TOKEN_KEY, tokenToValidate);
        setIsAuthenticated(true);
      } else {
        // If validation fails, clear token and show error
        localStorage.removeItem(TOKEN_KEY);
        setAuthError('Invalid token. Please try again.');
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Error validating token:', err);
      setAuthError('Network error while validating token.');
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  };
  
  const handleTokenSubmit = async (e: Event) => {
    e.preventDefault();
    if (!token().trim()) {
      setAuthError('Please enter a token');
      return;
    }
    
    await validateToken(token());
  };

  const handleFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      setFile(target.files[0]);
    }
  };

  const handleTextChange = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    setTextInput(target.value);
  };

  const processFile = async () => {
    setLoading(true);
    setError('');
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const selectedFile = file();
      const authToken = localStorage.getItem(TOKEN_KEY);
      
      if (inputMethod() === 'file' && !selectedFile) {
        throw new Error('Please select a file');
      }
      
      if (inputMethod() === 'text' && !textInput().trim()) {
        throw new Error('Please enter text');
      }

      if (!authToken) {
        throw new Error('Authentication required');
      }

      let response;
      const authHeaders = { 'Authorization': `Bearer ${authToken}` };
      
      if (inputMethod() === 'file') {
        const formData = new FormData();
        formData.append('file', selectedFile!);
        
        response = await fetch(`${baseUrl}/api/v1/doc2anki`, {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });
      } else {
        response = await fetch(`${baseUrl}/api/v1/text2anki`, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: textInput() }),
        });
      }

      if (!response.ok) {
        // Handle authentication errors specially
        if (response.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setIsAuthenticated(false);
          throw new Error('Your session has expired. Please re-enter your super secret token.');
        }
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data: AnkiResponse = await response.json();
      setCards(data.cards);
    } catch (err) {
      console.error('Error processing input:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateCard = (index: number, field: 'front' | 'back', value: string) => {
    setCards(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };
  
  const removeCard = (index: number) => {
    setCards(prev => prev.filter((_, i) => i !== index));
  };

  const exportToAnki = () => {
    // Format each card, properly escaping newlines in content
    const cardData = cards().map(card => {
      // Process front and back content to handle newlines
      // Replace literal newlines with HTML line breaks for Anki
      const processedFront = card.front.replace(/\n/g, '<br>');
      const processedBack = card.back.replace(/\n/g, '<br>');
      
      return `${processedFront}\t${processedBack}`;
    }).join('\n');
    
    const blob = new Blob([cardData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anki_cards.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div class="container mx-auto px-4 py-8 max-w-4xl min-h-screen bg-gray-900 text-gray-100">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-center text-white">Notes2Anki 🤓</h1>
        <p class="text-center">This is quick and dirty, lmk if it breaks</p>
        <div class="flex justify-center mt-4">
          <img src="/goofy.gif" alt="Goofy training animation" class="w-64" />
        </div>
      </div>
      
      <Show when={authLoading()}>
        <div class="flex justify-center items-center py-12">
          <div class="animate-pulse flex flex-col items-center">
            <div class="h-16 w-16 mb-4 rounded-full bg-blue-500"></div>
            <div class="text-xl text-gray-300">Authenticating...</div>
          </div>
        </div>
      </Show>
      
      <Show when={!authLoading() && !isAuthenticated()}>
        <div class="bg-gray-800 rounded-lg shadow-md p-6 mb-8 max-w-md mx-auto">
          <h2 class="text-xl font-bold mb-4 text-white">Auth Required</h2>
          <p class="mb-6 text-gray-300">Please enter your super secret token to continue</p>
          
          <form onSubmit={handleTokenSubmit} class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Super Secret Token
              </label>
              <input 
                type="password"
                value={token()}
                onInput={(e) => setToken((e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-200"
                placeholder="Enter your super secret token..."
              />
            </div>
            
            <button 
              type="submit"
              class="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-transform hover:scale-[1.02] hover:cursor-pointer"
            >
              Authenticate
            </button>
            
            <Show when={authError()}>
              <div class="text-red-400">{authError()}</div>
            </Show>
          </form>
        </div>
      </Show>
      
      <Show when={!authLoading() && isAuthenticated()}>
        <div class="bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <div class="flex gap-4 mb-4">
            <button 
              class={`px-4 py-2 rounded ${
                inputMethod() === 'file' 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white hover:cursor-pointer' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:cursor-pointer'
              }`}
              onClick={() => setInputMethod('file')}
            >
              Upload File
            </button>
            <button 
              class={`px-4 py-2 rounded ${
                inputMethod() === 'text' 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white hover:cursor-pointer' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:cursor-pointer'
              }`}
              onClick={() => setInputMethod('text')}
            >
              Enter Text
            </button>
          </div>

          <Show when={inputMethod() === 'file'}>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Upload .md or .txt file
              </label>
              <input 
                type="file" 
                accept=".md,.txt"
                onChange={handleFileChange}
                class="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-200 file:mr-4 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-blue-900 file:text-blue-200 file:hover:bg-blue-800 file:cursor-pointer hover:cursor-pointer"
              />
            </div>
          </Show>

          <Show when={inputMethod() === 'text'}>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Enter your notes
              </label>
              <textarea 
                value={textInput()}
                onChange={handleTextChange}
                class="w-full px-3 py-2 border border-gray-600 rounded-md h-40 bg-gray-700 text-gray-200 placeholder:text-gray-500"
                placeholder="Enter your notes here..."
              />
            </div>
          </Show>

          <div class="flex justify-between items-center">
            <button 
              onClick={processFile}
              disabled={loading()}
              class="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md disabled:bg-blue-800 transition-transform hover:scale-[1.02] hover:cursor-pointer"
            >
              {loading() ? 'Processing...' : 'Generate Anki Cards'}
            </button>
            
            <button 
              onClick={() => {
                localStorage.removeItem(TOKEN_KEY);
                setIsAuthenticated(false);
                setToken('');
              }} 
              class="ml-4 px-3 py-2 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-transform hover:scale-110 hover:cursor-pointer"
              title="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
          
          <Show when={error()}>
            <div class="mt-4 text-red-400">{error()}</div>
          </Show>
        </div>

        <Show when={cards().length > 0}>
          <div class="bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 class="text-xl font-bold mb-4 text-white">Anki Cards ({cards().length})</h2>
            
            <div class="space-y-6">
              <For each={cards()}>
                {(card, index) => (
                  <div class="border border-gray-700 rounded-md p-4 relative">
                    <button 
                      onClick={() => removeCard(index())}
                      class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-400 bg-gray-700 hover:bg-gray-600 rounded-full hover:scale-110 hover:cursor-pointer"
                      title="Remove card"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                    </button>
                    <div class="mb-3 mt-3">
                      <label class="block text-sm font-medium text-gray-300 mb-1">
                        Front (Question)
                      </label>
                      <input 
                        type="text"
                        value={card.front}
                        onInput={(e) => updateCard(index(), 'front', (e.target as HTMLInputElement).value)}
                        class="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-200"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-1">
                        Back (Answer)
                      </label>
                      <textarea 
                        value={card.back}
                        onInput={(e) => updateCard(index(), 'back', (e.target as HTMLTextAreaElement).value)}
                        class="w-full px-3 py-2 border border-gray-600 rounded-md h-32 bg-gray-700 text-gray-200"
                      />
                    </div>
                  </div>
                )}
              </For>
            </div>
            
            <button 
              onClick={exportToAnki}
              class="mt-6 w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-md transition-transform hover:scale-[1.02] hover:cursor-pointer"
            >
              Export to Anki
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default App;
