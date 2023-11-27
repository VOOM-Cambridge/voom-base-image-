import React from 'react';
import Paho from 'paho-mqtt'
import uuid from 'uuid4';
import * as dayjs from 'dayjs'

const MQTTSendContext = React.createContext();

export function useMQTTSend() {
  const context = React.useContext(MQTTSendContext);
  if (context === undefined) {
    throw new Error("useMQTTSend must be used within a MQTTProvider");
  }

  return context;
}

const MQTTStateContext = React.createContext();
const MQTTDispatchContext = React.createContext();

export function useMQTTState() {
  const context = React.useContext(MQTTStateContext);
  if (context === undefined) {
    throw new Error("useMQTTState must be used within a MQTTProvider");
  }

  return context;
}

export function useMQTTDispatch() {
  const context = React.useContext(MQTTDispatchContext);
  if (context === undefined) {
    throw new Error("useMQTTDispatch must be used within a MQTTProvider");
  }

  return context;
}


const DefaultReducer = (currentState, action) => {
  console.log(action)
  switch (action.type) {
    case 'STATUS':
      return {
        ...currentState,
        connected: action.connected
      };
    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
};

async function default_new_message_action(dispatch, message) {
  //do nothing
}

export const MQTTProvider = ({
  children,
  host,
  port = 1883,
  reducer = DefaultReducer,
  prefix=[],
  subscriptions = [],
  initial_state = { connected: false },
  new_message_action = default_new_message_action,
  debug = false
}) => {
  const clientID = uuid()
  const [connected, setConnected] = React.useState(false)
  const [connecting, setConnecting] = React.useState(false)
  const [state, dispatch] = React.useReducer(reducer, initial_state);
  const [lastJsonMessage, setLastJsonMessage] = React.useState(undefined)
  const [client, setClient] = React.useState(undefined)

  React.useEffect(() => {
    if (!connected && !connecting) {
      let new_client = new Paho.Client(host, Number(port), clientID)
      console.log("Connecting to ",host," on ",port)

      // called when the client connects
      function onConnect() {
        // Once a connection has been made, make a subscription and send a message.
        console.log("onConnect");
        dispatch({ type: 'STATUS', connected: true })
        subscriptions.forEach(topic => client.subscribe(topic))
        setConnected(true)
        setConnecting(false)
      }

      // set callback handlers
      new_client.onConnectionLost = onConnectionLost;
      new_client.onMessageArrived = onMessageArrived;
      // connect the client
      new_client.connect({ onSuccess: onConnect, onFailure:onConnectionLost});
      setConnecting(true)
      setClient(new_client)
    }
  }, [connected,connecting, client, host, port, clientID, subscriptions])

  function sendJsonMessage(topic, payload) {
    //add timestamp to message if not present
    payload = {timestamp:dayjs().format(),...payload}
    //ensure topic is wrapped in array
    if(!Array.isArray(topic))
      topic = [topic]
    //form strings
    const payload_string = JSON.stringify(payload)
    const topic_string = [...prefix,...topic].join("/")
    console.log("MQTT SEND: ",payload_string," TO ",topic_string);
    
    let message = new Paho.Message(payload_string );
    message.destinationName = topic_string;
    client.send(message);
  }

  // called when the client loses its connection
  function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
      console.log("onConnectionLost:" + responseObject.errorMessage);
    }
    dispatch({ type: 'STATUS', connected: false })
    setConnected(false)
  }

  // called when a message arrives
  function onMessageArrived(message) {
    console.log("onMessageArrived:" + message.payloadString);
    setLastJsonMessage(JSON.parse(message.payloadString))
  }

  React.useEffect(() => {
    new_message_action(dispatch, lastJsonMessage)
  }, [lastJsonMessage, new_message_action]);

  return (
    <MQTTSendContext.Provider value={sendJsonMessage}>
      <MQTTStateContext.Provider value={state}>
        <MQTTDispatchContext.Provider value={dispatch}>
          {children}
        </MQTTDispatchContext.Provider>
      </MQTTStateContext.Provider>
    </MQTTSendContext.Provider>
  );
};

