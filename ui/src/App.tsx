import { useState, useEffect, useRef } from 'react';

interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
}

interface Tool {
  id: number;
  name: string;
  description: string;
}

interface DebugTrace {
  id: number;
  timestamp: string;
  type: string;
  content: string;
}

const initialMessages: Message[] = [
  { id: 1, sender: "user", text: "Hello! How can you help me today?" },
  { id: 2, sender: "ai", text: "Hi there! I can help you with a variety of tasks. What do you need?" },
];

const initialAvailableTools: Tool[] = [
  { id: 1, name: "get_weather", description: "Fetches the current weather for a location." },
  { id: 2, name: "search_web", description: "Searches the web for information." },
  { id: 3, name: "create_file", description: "Creates a new file with specified content." },
];

const initialDebugTraces: DebugTrace[] = [
  { id: 1, timestamp: "10:30:01", type: "User Query", content: "Hello! How can you help me today?" },
  { id: 2, timestamp: "10:30:02", type: "LLM Response", content: "Hi there! I can help you with a variety of tasks. What do you need?" },
];

function App() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [currentMessage, setCurrentMessage] = useState("");
  const [availableTools] = useState<Tool[]>(initialAvailableTools);
  const [debugTraces, setDebugTraces] = useState<DebugTrace[]>(initialDebugTraces);
  const [activeTab, setActiveTab] = useState('tools'); // 'tools' or 'debug'

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (currentMessage.trim() === "") return;
    const timestamp = Date.now();

    const newUserMessage: Message = {
      id: timestamp,
      sender: 'user',
      text: currentMessage.trim(),
    };

    const newDebugUserQuery: DebugTrace = {
      id: timestamp + 1, 
      timestamp: new Date().toLocaleTimeString(),
      type: "User Query",
      content: currentMessage.trim(),
    }

    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setDebugTraces((prevTraces) => [...prevTraces, newDebugUserQuery]);
    setCurrentMessage("");

    setTimeout(() => {
      const aiResponseText = "This is a canned AI response. I received: '" + newUserMessage.text + "'";
      const aiTimestamp = Date.now();
      const newAiMessage: Message = {
        id: aiTimestamp,
        sender: 'ai',
        text: aiResponseText,
      };
      const newDebugAiResponse: DebugTrace = {
        id: aiTimestamp + 1,
        timestamp: new Date().toLocaleTimeString(),
        type: "LLM Response (Canned)",
        content: aiResponseText,
      }
      setMessages((prevMessages) => [...prevMessages, newAiMessage]);
      setDebugTraces((prevTraces) => [...prevTraces, newDebugAiResponse]);
    }, 1000);
  };

  return (
    // Ensure this main div takes full viewport height and is a flex container for its children rows/columns
    <div className="container-fluid vh-100 d-flex flex-column p-2" style={{backgroundColor: '#f8f9fa'}}>
      <div className="row flex-grow-1 overflow-hidden gy-2 gx-2"> {/* Added gy-2 gx-2 for gutter spacing between cols if they wrap or are side-by-side visually */}
        {/* Main Chat Area Column*/}
        <div className="col-lg-8 col-md-7 d-flex flex-column h-100">
          <h1 className="h3 mb-3 fw-bold text-primary">Chat with AI Agent</h1>
          <div className="card flex-grow-1 d-flex flex-column shadow-sm">
            <div className="card-header bg-light">
              <h2 className="h5 mb-0 py-1 fw-normal">Conversation</h2>
            </div>
            <div ref={messagesContainerRef} className="card-body overflow-auto d-flex flex-column p-3" style={{backgroundColor: '#fdfdfe'}}>
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`p-2 my-1 rounded shadow-sm w-75 ${msg.sender === 'user' ? 'bg-primary text-white align-self-end' : 'bg-light text-dark align-self-start'}`}
                  style={{maxWidth: '75%'}}
                >
                  {msg.text}
                </div>
              ))}
              {/* <div ref={messagesEndRef} />  Removed as direct scroll on container is used */}
            </div>
            <div className="card-footer bg-white p-3">
              <div className="input-group">
                <textarea
                  placeholder="Type your message..."
                  className="form-control shadow-none"
                  rows={2}
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  style={{resize: 'none'}}
                />
                <button className="btn btn-primary" type="button" onClick={handleSendMessage}>Send</button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Column*/}
        <div className="col-lg-4 col-md-5 d-flex flex-column h-100">
          <div className="card flex-grow-1 d-flex flex-column shadow-sm overflow-hidden">
            <div className="card-header bg-light p-0">
              <ul className="nav nav-tabs nav-fill" id="sidebarTabs" role="tablist">
                <li className="nav-item" role="presentation">
                  <button 
                    className={`nav-link w-100 ${activeTab === 'tools' ? 'active' : ''}`}
                    id="tools-tab" 
                    onClick={() => setActiveTab('tools')} 
                    type="button" role="tab" aria-controls="tools-pane" 
                    aria-selected={activeTab === 'tools'}
                  >
                    Tools
                  </button>
                </li>
                <li className="nav-item" role="presentation">
                  <button 
                    className={`nav-link w-100 ${activeTab === 'debug' ? 'active' : ''}`}
                    id="debug-tab" 
                    onClick={() => setActiveTab('debug')} 
                    type="button" role="tab" aria-controls="debug-pane" 
                    aria-selected={activeTab === 'debug'}
                  >
                    Debug
                  </button>
                </li>
              </ul>
            </div>
            <div className="card-body p-0 flex-grow-1 d-flex flex-column overflow-hidden">
              <div className="tab-content h-100" id="sidebarTabContent">
                <div 
                  className={`tab-pane fade ${activeTab === 'tools' ? 'show active' : ''} h-100 d-flex flex-column`}
                  id="tools-pane" role="tabpanel" aria-labelledby="tools-tab"
                >
                  <div className="list-group list-group-flush overflow-auto flex-grow-1 p-2">
                    {availableTools.map((tool) => (
                      <div key={tool.id} className="list-group-item py-2">
                        <p className="fw-semibold mb-0 small">{tool.name}</p>
                        <p className="text-muted small mb-0">{tool.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div 
                  className={`tab-pane fade ${activeTab === 'debug' ? 'show active' : ''} h-100 d-flex flex-column`}
                  id="debug-pane" role="tabpanel" aria-labelledby="debug-tab"
                >
                  <div className="list-group list-group-flush overflow-auto flex-grow-1 p-2">
                    {debugTraces.map((trace) => (
                      <div key={trace.id} className="list-group-item py-2 small">
                        <p className="fw-semibold mb-0">[{trace.timestamp}] {trace.type}:</p>
                        <p className="text-muted mb-0" style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{trace.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
