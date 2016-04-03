;(function(){
// Dictionary of devices.
var devices = {};

// the connected device, once connection has been confirmed
var deviceHandle = null; 
// Handles to characteristics and descriptor for reading and
// writing data from/to the Arduino using the BLE shield.
var characteristicRead = null;
var characteristicWrite = null;
var descriptorNotification = null;

// Timer that displays list of devices.
var timer = null;

// utf-8 text encoders to translate from 16-byte js characters to a Uint8Array for transmission
var utf8Encoder = new TextEncoder("utf-8");
var utf8Decoder = new TextDecoder("utf-8");

/* Globals Definiton 
 * Variables initialized in this block are defined above functions below.
 */

/* function bufferForWrite */
var txBuffer; // String

/* function writeFromBuffer */
var waitingForResponse; // semaphore
var currentAttemptBuffer; //Uint8Array

/* 
 * END Globals Initialization
 */

function onDeviceReady()
{
	// Start tracking devices!
	setTimeout(startScan, 500);

	// Timer that refreshes the display.
	timer = setInterval(updateDeviceList, 500);
}

function onBackButtonDown()
{
	evothings.ble.stopScan();
	evothings.ble.close();
	navigator.app.exitApp();
}

function enablePrinting() {
	$("#print-button-container").removeClass("hidden"); //init
	$("#print-button").prop("disabled", false);
	$('#print-button').on('click', onPrintButtonClick);
}

function onPrintButtonClick( event ) {
		var message = '';
		var now = new Date();
		
		message += "MSG\x00"; // BEGIN
		message +=  now.toDateString() + "\x00"; // Date
		message +=  now.toTimeString() + "\x00"; // Time
		message += $("#location").val() + "\x00"; // Location
		message += $("#plate").val() + "\x00"; // License Plate
		message += $("#description").val() + "\x00"; // Description
		message += $("#reason").val() + "\x00"; // Reason
		message += "\x17EOT\x00"; // EOT
		
		showMessage("Printing...");
		
		console.log("Attempting write");
		console.log(message);
		
		bufferForWrite('writeCharacteristic',
			deviceHandle,
			characteristicWrite,
			message);
			
		event.preventDefault();
		event.stopPropagation();
		return false;
}

function disablePrinting() {
	$("#print-button").prop("disabled", true);
	$('#print-button').off('click');
}

function startScan()
{
	// the device we are attempting connecting to, before the success response 
	var conectee = null;
	showMessage('Scan in progress.');
	evothings.ble.startScan(
		// Nordic UART Service UUID 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
		// Remove or set this parameter to null to scan for all
		// devices regardless of advertised services.8
		['6E400001-B5A3-F393-E0A9-E50E24DCCA9E'], 
		function(device)
		{
			console.log('got device ' + device.name + ' ' + device.address);
			// Update device data.
			device.timeStamp = Date.now();
			devices[device.address] = device;
			if (device.name == "Adafruit Bluefruit LE" && !conectee) {
				console.log("Found printer with address: " + device.address);
				conectee = device;
				connect(device.address);
			}
		},
		function(error)
		{
			showMessage('BLE scan error: ' + error);
		});
}

function connect( address ) {
	evothings.ble.stopScan();
	showMessage('Connecting...');
	evothings.ble.connect(
		address,
		function(connectInfo)
		{
			if (connectInfo.state == 2) // Connected
			{
				deviceHandle = connectInfo.deviceHandle;
				getServices(connectInfo.deviceHandle);
			}
			else
			{
				showMessage('Disconnected');
				handleDisconnect();
			}
		},
		function(errorCode)
		{
			showMessage('connect error: ' + errorCode);
			handleDisconnect();
		});
}

function handleDisconnect() {
	disablePrinting();
	evothings.ble.close(deviceHandle);
	deviceHandle = null;
	txBuffer = {};
	setTimeout(startScan, 1000);
}

// for data consistency globally buffer and wait for success resp before sending next 20 bytes
var txBuffer; // String
function bufferForWrite (writeFunc, device, handle, data) {
	if(txBuffer[writeFunc] == undefined) {
		txBuffer[writeFunc] = {device: {handle: data}};
	} else if (txBuffer[writeFunc][device] == undefined) {
		txBuffer[writeFunc][device] = {handle: data};
	} else {
		txBuffer[writeFunc][device][handle] = data;
	}
	writeFromBuffer(writeFunc, device, handle);
}

/*
 * If a response is not being waited on:
 * An empty buffer signifies that the previous write operation has succeded.
 * An intact buffer will be retransmitted next time writeFromBuffer() is called.
 */
var waitingForResponse; // semaphore
var currentAttemptBuffer; //Uint8Array
function writeFromBuffer(writeFunc, device, handle) {
	if (waitingForResponse[writeFunc][device][handle] == true) {
		return;
	} else if (handle) {
		if (currentAttemptBuffer[writeFunc][device][handle] == null || currentAttemptBuffer[writeFunc][device][handle].length == 0) {
			if (txBuffer[writeFunc][device][handle] == null || txBuffer[writeFunc][device][handle] == "") {
				return; // no data to send
			}
			var tempStringContainer = {string: txBuffer[writeFunc][device][handle]};
			currentAttemptBuffer[writeFunc][device][handle] = shiftTwentyBytesOrLessFromString(tempStringContainer);				
			txBuffer[writeFunc][device][handle] = tempStringContainer.string;				
		}
		waitingForResponse[writeFunc][device][handle] = true;
		evothings.ble[writeFunc](
			device,
			handle,
			currentAttemptBuffer[writeFunc][device][handle],
			function() //success
			{
				waitingForResponse[writeFunc][device][handle] = false;
				currentAttemptBuffer[writeFunc][device][handle] = null;
				console.log(writeFunc + ': ' + handle + ' success.');
				writeFromBuffer(writeFunc, device, handle);
			},
			function(errorCode) // fail
			{
				waitingForResponse[writeFunc][device][handle] = false;
				console.log(writeFunc + ': ' + handle + ' error: ' + errorCode);
				writeFromBuffer(writeFunc, device, handle);
			});
	}
}

// This function will modify the string it is passed
// stringContainer = {string: 'string'};
function shiftTwentyBytesOrLessFromString( stringContainer ) {
	var sliceSize = 21; // will decrement to correct value before first use
	do {
		--sliceSize;
		var attempt = utf8Encoder.encode(stringContainer.string.substr(0, sliceSize));
	} while (attempt.length > 20);
	stringContainer.string = stringContainer.string.substr(sliceSize);
	return attempt;
}

function write (writeFunc, device, handle, value)
{
	if (handle)
	{
		evothings.ble[writeFunc](
			device,
			handle,
			value,
			function()
			{
				console.log(writeFunc + ': ' + handle + ' success.');
			},
			function(errorCode)
			{
				console.log(writeFunc + ': ' + handle + ' error: ' + errorCode);
			});
	}
}

function getServices ( device ) {
	showMessage('Reading services...');

	evothings.ble.readAllServiceData(device, function(services)
	{
		// Find handles for characteristics and descriptor needed.
		for (var si in services)
		{
			var service = services[si];

			for (var ci in service.characteristics)
			{
				var characteristic = service.characteristics[ci];

				if (characteristic.uuid == '6e400003-b5a3-f393-e0a9-e50e24dcca9e')
				{
					characteristicRead = characteristic.handle;
				}
				else if (characteristic.uuid == '6e400002-b5a3-f393-e0a9-e50e24dcca9e')
				{
					characteristicWrite = characteristic.handle;
				}

				for (var di in characteristic.descriptors)
				{
					var descriptor = characteristic.descriptors[di];
					
					
					console.log("===================");
					console.log("Characteristic: " + characteristic.uuid);
					console.log("Descriptor: " + descriptor.uuid);
					console.log("===================");
					

					if (characteristic.uuid == '6e400003-b5a3-f393-e0a9-e50e24dcca9e' &&
						descriptor.uuid == '00002902-0000-1000-8000-00805f9b34fb')
					{
						descriptorNotification = descriptor.handle;
					}
				}
			}
		}

		if (characteristicRead && characteristicWrite && descriptorNotification)
		{
			console.log('RX/TX services found.');
			setupWriteBuffers(device);
			startReading(device);
			enablePrinting();
		}
		else
		{
			showMessage('ERROR: RX/TX services not found!');
		}
	},
	function(errorCode)
	{
		showMessage('readAllServiceData error: ' + errorCode);
	});
}

function setupWriteBuffers( device ) {
	txBuffer = {writeCharacteristic: {}, writeDescriptor: {}};
	txBuffer['writeCharacteristic'][device] = [];
	txBuffer['writeDescriptor'][device] = [];
	currentAttemptBuffer = {writeCharacteristic: {}, writeDescriptor: {}};
	currentAttemptBuffer['writeCharacteristic'][device] = [];
	currentAttemptBuffer['writeDescriptor'][device] = [];
	waitingForResponse = {writeCharacteristic: {}, writeDescriptor: {}};
	waitingForResponse['writeCharacteristic'][device] = [];
	waitingForResponse['writeDescriptor'][device] = [];
}

function startReading ( device ) {
	showMessage('Enabling notifications...');

	// Turn notifications on.
	// This writes a value of 0x01,0x00 to the CCCD of the TX characteristic (enable notifications)
	// http://stackoverflow.com/questions/15657007/bluetooth-low-energy-listening-for-notifications-indications-in-linux
	// CCCD: Client Characteristic Configuration Descriptor
	write(
		'writeDescriptor',
		device,
		descriptorNotification, // the descriptor of the TX/read characteristic
		new Uint8Array([1,0]));			

	// Start reading notifications.
	evothings.ble.enableNotification(
		device,
		characteristicRead,
		function(data)
		{
			showMessage('Active');
			if(data) {
				console.log(evothings.ble.fromUtf8(data));
			}
		},
		function(errorCode)
		{
			showMessage('enableNotification error: ' + errorCode);
		});
}

// Map the RSSI value to a value between 1 and 100.
function mapDeviceRSSI(rssi)
{
	if (rssi >= 0) return 1; // Unknown RSSI maps to 1.
	if (rssi < -100) return 100; // Max RSSI
	return 100 + rssi;
}

function getSortedDeviceList(devices)
{
	var deviceList = [];
	for (var key in devices)
	{
		deviceList.push(devices[key]);
	}
	deviceList.sort(function(device1, device2)
	{
		return mapDeviceRSSI(device1.rssi) < mapDeviceRSSI(device2.rssi);
	});
	return deviceList;
}

function updateDeviceList()
{
	removeOldDevices();
	displayDevices();
}

function removeOldDevices()
{
	var timeNow = Date.now();
	for (var key in devices)
	{
		// Only show devices updated during the last 60 seconds.
		var device = devices[key];
		if (device.timeStamp + 60000 < timeNow)
		{
			delete devices[key];
		}
	}
}

function displayDevices()
{
	var html = '';
	var sortedList = getSortedDeviceList(devices);
	for (var i = 0; i < sortedList.length; ++i)
	{
		var device = sortedList[i];
		var htmlDevice =
			'<p data-address="' + device.address +'">'
			+	htmlDeviceName(device)
			+	htmlDeviceRSSI(device)
			+ '</p>';
		html += htmlDevice
	}
	document.querySelector('#found-devices').innerHTML = html;
}

function htmlDeviceName(device)
{
	var name = device.name || 'no name';
	return '<strong>' + name + '</strong><br/>';
}

function htmlDeviceRSSI(device)
{
	return device.rssi ?
		'RSSI: ' + device.rssi + '<br/>' :  '';
}

function showMessage(text)
{
	document.querySelector('#message').innerHTML = text;
	console.log(text);
}

// This calls onDeviceReady when Cordova has loaded everything.
document.addEventListener('deviceready', onDeviceReady, false);

// Add back button listener (for Android).
document.addEventListener('backbutton', onBackButtonDown, false);
})();