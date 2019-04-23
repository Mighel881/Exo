window.onload = () => {
    // Make sure to disable double tap zoom.
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    var head = document.getElementsByTagName('head')[0];
    head.appendChild(meta);

    window.exo.init();
}

window.exo = (() => {
    let formatRe = /{([\w\.]+)}/g;
    let currentData = {};
    let boundFunctions = {};
    let eventHandlers = {};
    let filters = {};
    let options = {
        'autobind': true
    };

    function getValue(name) {
        if (filters[name]) {
            return filters[name](currentData[name]);
        } else {
            return currentData[name];
        }
    }

    function createContentFunction(element, property, format, variables) {
        return () => {
            if (property.startsWith("@class")) {
                let className = property.replace("@class.", "");
                if (format.startsWith("!")) {
                    if (!getValue(format.slice(1))) {
                        element.classList.add(className);
                    } else {
                        element.classList.remove(className);
                    }
                } else {
                    if (getValue(format)) {
                        element.classList.add(className);
                    } else {
                        element.classList.remove(className);
                    }
                }

                return;
            }

            let content = format;

            for (let variable of variables) {
                let value = getValue(variable.slice(1,-1));
                if (typeof value == 'undefined' || value == null) value = "";

                content = content.split(variable).join(value);
            }

            if (property.startsWith("@")) {
                element.setAttribute(property.slice(1), content);
            } else {
                element[property] = content;
            }
        };
    }

    function updateGeneratedData() {
        exo._update({
            'time': new Date().toLocaleTimeString()
        });
    }
    
    function addTo(object, element, variables) {
        for (let variable of variables) {
            let key = variable.slice(1,-1);
            if (!object[key]) {
                object[key] = [element];
            } else {
                for (let objElement of object[key]) {
                    if (objElement === element) return;
                }
                
                object[key].push(element);
            }
        }
    }

    function callHandlers(name, data) {
        if (!eventHandlers[name]) return;

        for (let handler of eventHandlers[name]) {
            handler(data);
        }
    }
    
    function getTextNodes(element) {
        return Array.from(element.childNodes).filter(child => child.nodeType === Node.TEXT_NODE);
    }

    let exo = (selector) => {
        let elements = document.querySelectorAll(selector);

        elements.bindContent = (format) => {
            let variables = format.match(formatRe);
            if (variables.length == 0) return;

            for (let element of elements) {
                if (!element.exo) element.exo = {};
                let fn = createContentFunction(element, 'innerText', format, variables);
                addTo(boundFunctions, fn, variables);
                fn();
            }
        };

        elements.autobind = () => {
            for (let element of elements) {
                for (let attribute of element.attributes) {
                    if (!attribute.name.startsWith("@")) continue;

                    let variables = [];
                    if (!attribute.name.startsWith("@class.")) {
                        variables = attribute.value.match(formatRe);
                        if (!variables || variables.length == 0) continue;
                    }
                    
                    let fn = createContentFunction(element, attribute.name, attribute.value, variables);
                    addTo(boundFunctions, fn, variables);
                    fn();
                }

                if (element.tagName == 'SCRIPT' || element.tagName == 'STYLE' || element.tagName == 'NOSCRIPT' || element.tagName == 'IFRAME') continue;
                
                let textNodes = getTextNodes(element);
                if (!textNodes || textNodes.length == 0) continue;
                
                for (let textNode of textNodes) {
                    let variables = textNode.nodeValue.match(formatRe);
                    if (!variables || variables.length == 0) continue;

                    if (!element.exo) element.exo = {};
                    let fn = createContentFunction(textNode, 'nodeValue', textNode.nodeValue, variables);
                    addTo(boundFunctions, fn, variables);
                    fn();
                }
            }
        };

        return elements;
    };
    
    exo._update = (data) => {
        let fnsToUpdate = [];
        for (let key of Object.keys(data)) {
            if (currentData[key] === data[key]) {
                delete data[key];
                continue;
            }

            currentData[key] = data[key];
            callHandlers("update." + key, data[key]);

            if (boundFunctions[key]) {
                for (let fn of boundFunctions[key]) {
                    let contains = false;
                    for (let f of fnsToUpdate) {
                        if (fn === f) {
                            contains = true;
                            break;
                        }
                    }

                    if (!contains) {
                        fnsToUpdate.push(fn);
                    }
                }
            }
        }

        for (let fn of fnsToUpdate) {
            fn();
        }

        callHandlers("update", data);
    };

    exo.bind = (event, handler) => {
        if (!eventHandlers[event]) {
            eventHandlers[event] = [handler];
            return;
        }

        eventHandlers[event].push(handler);
    };

    exo.action = (action) => {
        if (!action || !window['webkit']) return;

        if (typeof action === "object" || typeof action === "string") {
            webkit.messageHandlers.action.postMessage(action);
        }
    };

    exo.setFilter = (name, filter) => {
        filters[name] = filter;
    };

    exo.setOption = (name, value) => {
        options[name] = value;
    };

    exo.get = (name, skipFilters) => {
        if (skipFilters) {
            return currentData[name];
        } else {
            return getValue(name);
        }
    };

    exo.set = (name, value) => {
        exo._update({
            [name]: value
        });
    };

    exo.log = (message) => {
        exo.action({
            action: "log",
            message: message
        });
    };

    exo.init = () => {
        if (options['autobind']) {
            exo('body *').autobind();
        }
    };

    updateGeneratedData();
    setInterval(updateGeneratedData, 1000);
    exo.action("requestUpdate");

    return exo;
})();