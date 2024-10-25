// JavaScript for the Utility Management System

document.getElementById('register-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const serviceType = document.getElementById('service-type').value;
    const latitude = document.getElementById('latitude').value;
    const longitude = document.getElementById('longitude').value;

    const provider = { name, serviceType, latitude, longitude };
    
    // Simulate sending this to the server (currently just log to console)
    console.log("Registered Provider:", provider);
    alert("Service provider registered successfully!");
});

document.getElementById('find-providers').addEventListener('click', function () {
    // For now, we'll simulate finding providers by displaying dummy data.
    const providerList = [
        { name: "John Doe", serviceType: "Plumber", distance: "3km" },
        { name: "Jane Smith", serviceType: "Electrician", distance: "4.5km" }
    ];

    const providerListElement = document.getElementById('provider-list');
    providerListElement.innerHTML = ""; // Clear previous results

    providerList.forEach(provider => {
        const li = document.createElement('li');
        li.textContent = `${provider.name} - ${provider.serviceType} - ${provider.distance} away`;
        providerListElement.appendChild(li);
    });
});
