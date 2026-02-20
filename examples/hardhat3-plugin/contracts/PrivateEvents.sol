// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract PrivateEvents {
    // Public events with string parameters
    event PublicEvent1(string message);
    event PublicEvent2(string data);
    
    // Private events (these will be wrapped in PrivateEvent by the Silent Data rollup)
    event PrivateEvent1(string secretMessage);
    event PrivateEvent2(string privateData);
    
    // The PrivateEvent wrapper that Silent Data uses
    event PrivateEvent(
        address[] allowedViewers,
        bytes32 indexed eventType,
        bytes payload
    );
    
    // Event type constants for private events
    bytes32 public constant EVENT_TYPE_PRIVATE_1 = keccak256("PrivateEvent1(string)");
    bytes32 public constant EVENT_TYPE_PRIVATE_2 = keccak256("PrivateEvent2(string)");
    
    // Function to trigger all events in one transaction
    function triggerEvents(
        string memory publicMessage1,
        string memory publicMessage2,
        string memory privateMessage1,
        string memory privateMessage2,
        address[] memory allowedViewers
    ) external {
        // Emit public events
        emit PublicEvent1(publicMessage1);
        emit PublicEvent2(publicMessage2);
        
        // Emit private events wrapped in PrivateEvent
        emit PrivateEvent(
            allowedViewers,
            EVENT_TYPE_PRIVATE_1,
            abi.encode(privateMessage1)
        );
        
        emit PrivateEvent(
            allowedViewers,
            EVENT_TYPE_PRIVATE_2,
            abi.encode(privateMessage2)
        );
    }
}