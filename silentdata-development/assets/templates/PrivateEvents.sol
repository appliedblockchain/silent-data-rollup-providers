// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title PrivateEvents
 * @notice Template contract demonstrating private events on Silent Data.
 * @dev Private events are only visible to addresses in the allowedViewers array.
 *      The Custom RPC filters events based on the authenticated caller.
 *
 * ⚠️  WARNING: This is a DEMO template. In production:
 *      - Make emit functions internal, not external
 *      - Only emit events tied to actual state changes
 *      - Add proper access control (onlyOwner, etc.)
 *      - Anyone can call these public functions and emit fake events!
 */
contract PrivateEvents {
    /// @notice The standard PrivateEvent wrapper used by Silent Data
    event PrivateEvent(
        address[] allowedViewers,
        bytes32 indexed eventType,
        bytes payload
    );

    /// @notice Example: Private message event type
    bytes32 public constant EVENT_TYPE_MESSAGE = 
        keccak256("PrivateMessage(address,address,string)");

    /// @notice Example: Private transfer event type (matches standard ERC-20)
    bytes32 public constant EVENT_TYPE_TRANSFER = 
        keccak256("Transfer(address,address,uint256)");

    /// @notice Example: Private notification to a group
    bytes32 public constant EVENT_TYPE_NOTIFICATION = 
        keccak256("PrivateNotification(address[],string)");

    /**
     * @notice Send a private message visible only to sender and recipient
     * @param recipient The message recipient
     * @param message The message content
     */
    function sendPrivateMessage(
        address recipient, 
        string calldata message
    ) external {
        address[] memory viewers = new address[](2);
        viewers[0] = msg.sender;
        viewers[1] = recipient;

        emit PrivateEvent(
            viewers,
            EVENT_TYPE_MESSAGE,
            abi.encode(msg.sender, recipient, message)
        );
    }

    /**
     * @notice Emit a private transfer event visible to both parties
     * @dev ⚠️  DEMO ONLY: In production, make this internal and call only
     *      during actual token transfers to prevent fake event emission.
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     */
    function emitPrivateTransfer(
        address from,
        address to,
        uint256 amount
    ) external {
        address[] memory viewers = new address[](2);
        viewers[0] = from;
        viewers[1] = to;

        emit PrivateEvent(
            viewers,
            EVENT_TYPE_TRANSFER,
            abi.encode(from, to, amount)
        );
    }

    /**
     * @notice Send a notification to multiple parties
     * @param recipients Array of addresses who should see this notification
     * @param message The notification message
     */
    function notifyGroup(
        address[] calldata recipients,
        string calldata message
    ) external {
        emit PrivateEvent(
            recipients,
            EVENT_TYPE_NOTIFICATION,
            abi.encode(recipients, message)
        );
    }

    /**
     * @notice Send a notification only visible to the contract owner/admin
     * @param admin The admin address
     * @param data The admin-only data
     */
    function emitAdminOnly(address admin, bytes calldata data) external {
        address[] memory viewers = new address[](1);
        viewers[0] = admin;

        emit PrivateEvent(
            viewers,
            keccak256("AdminEvent(address,bytes)"),
            abi.encode(admin, data)
        );
    }
}
