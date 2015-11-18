var ee = angular.module('ee.controller', ['ee.services']);


ee.controller('GeneralMonitorController', function ($scope, $location, $routeParams, Cluster) {


  $scope.rid = $routeParams.server;


  $scope.tab = $routeParams.db;

  $scope.profilerOff = {content: "The Profiler for this server is Off. Just click the switch button above."}
  $scope.error = false;
  $scope.currentTab = 'overview';

  if ($scope.tab) {
    $scope.currentWarnings = true;
    $scope.currentTab = $scope.tab;
  }


  $scope.formatAddress = function (server) {
    if (server) {
      var address = ""
      var ports = " [";
      server.listeners.forEach(function (l, idx, arr) {
        if (idx == 0) {
          address += l.listen.split(":")[0];
        }
        ports += l.listen.split(":")[1];
        if (idx < arr.length - 1) {
          ports += ",";
        }
      });
      ports += "]";
      return address + ports;
    }
  }


  Cluster.node().then(function (data) {
    $scope.servers = data.members;
    $scope.server = $scope.servers[0];
  });


  $scope.editorOptions = {
    lineWrapping: true,
    lineNumbers: true,
    readOnly: true,
    mode: 'xml'
  };


  $scope.getServerMetrics = function () {


    var names = ["db.*.createRecord", "db.*.updateRecord", "db.*.readRecord", "db.*.deleteRecord"];

    var cfg = MetricConfig.create();
    cfg.name = $i18n.get('server.operations');
    cfg.server = $scope.server['@rid'];
    cfg.config = new Array;

    names.forEach(function (name) {
      cfg.config.push({name: name, field: 'entries'});
    })
    $scope.config = cfg;

  }

  $scope.$watch('attached', function (attached) {

    if (attached != null && $scope.server && $scope.server.attached != attached) {
      if (attached) {
        Server.connect($scope.server).then(function () {
          $scope.server.attached = true;
          $scope.attached = true;
        });
      } else {
        Server.disconnect($scope.server).then(function () {
          $scope.server.attached = false;
          $scope.attached = false;
        });
      }
    }
  });
  $scope.$watch("server", function (server) {
    if (server) {
      server.attached = true;
      $scope.attached = server.attached;

      $scope.databases = server.databases;

      Cluster.configFile(server).then(function (data) {
        $scope.configuration = data;
      });

    }
  });
  $scope.initMetrics = function () {
    var names = ["db.*.createRecord", "db.*.updateRecord", "db.*.readRecord", "db.*.deleteRecord"];
    var cfg = MetricConfig.create();
    cfg.name = $i18n.get('db.operations');
    cfg.server = $scope.server['@rid'];

    cfg.databases = db;
    cfg.config = new Array;

    names.forEach(function (name) {
      cfg.config.push({name: name, field: 'entries'});
    })
    $scope.configDb = cfg;
  }
  $scope.getDbMetrics = function (db) {
    var names = ["db.*.createRecord", "db.*.updateRecord", "db.*.readRecord", "db.*.deleteRecord"];
    var cfg = MetricConfig.create();
    cfg.name = $i18n.get('db.operations');
    cfg.server = $scope.server['@rid'];

    cfg.databases = db;
    cfg.config = new Array;

    names.forEach(function (name) {
      cfg.config.push({name: name, field: 'entries'});
    })
    $scope.configDb = cfg;
  }
  $scope.selectDb = function (db) {
    $scope.dbselected = db;

  }
  $scope.downloadDb = function (db) {
    $scope.dbselected = db;

    Cluster.backUp($scope.server, db);
    //Server.backUpDb($scope.server, db);
  }
  $scope.$watch('dbselected', function (data) {

    if (data) {
      $scope.getDbMetrics(data);
    }
  });

  $scope.$watch('databases', function (data) {

  });


});


ee.controller('SinglePollerController', function ($scope, $rootScope, $location, $routeParams, $timeout, Profiler, Cluster) {


  $scope.polling = true;

  var singlePoll = function () {

    Cluster.stats($scope.server.name).then(function (data) {
      data.name = $scope.server.name;
      $rootScope.$broadcast('server:updated', data);
    });
  }


  $rootScope.$on("$routeChangeStart", function (event, next, current) {
    $scope.polling = false;
  });
  var statsWatching = function (polling) {
    $timeout(function () {
      if ($scope.polling) {
        polling();
        statsWatching(polling);
      }
    }, POLLING);
  }

  statsWatching(singlePoll);
})


ee.controller('ClusterController', function ($scope, Cluster, Notification, $rootScope, $timeout) {


  $scope.polling = true;
  var clusterPolling = function () {
    Cluster.stats().then(function (data) {

      $scope.servers = data.members;

      $scope.clusterStats = data.clusterStats;
      //Object.keys(data.localNode.databases).forEach(function (db) {
      //  Cluster.database(db).then(function (data) {
      //    console.log(data);
      //  })
      //});

    }).catch(function (error) {
      Notification.push({content: error.data, error: true, autoHide: true});
    })
  }
  var statsWatching = function (polling) {
    $timeout(function () {
      if ($scope.polling) {
        polling();
        statsWatching(polling);
      }
    }, POLLING);
  }

  $rootScope.$on("$routeChangeStart", function (event, next, current) {
    $scope.polling = false;
  });

  statsWatching(clusterPolling)
})


ee.controller('ClusterOverviewController', function ($scope) {


  $scope.status = 'ONLINE';
  $scope.operations = 0;

  $scope.activeConnections = 0;

  $scope.agent = true;

  $scope.requests = 0;

  $scope.latency = 0;

  $scope.cpu = 0;
  $scope.disk = 0;
  $scope.ram = 0;

  var lastRequest = null;
  var lastOps = null;

  $scope.$watch('clusterStats', function (data) {
    if (data) {

      var keys = Object.keys(data);
      var cpu = 0;
      var diskTotal = 0;
      var diskUsable = 0;
      var maxMemory = 0
      var totalMemory = 0;
      var availableMemory = 0;
      var connections = 0;
      var requests = 0;
      var latency = 0;
      var operations = 0;
      keys.forEach(function (val) {
        var realtime = data[val].realtime;
        // CPU
        var cpuN = realtime['hookValues']['process.runtime.cpu'];
        cpu += parseFloat(cpuN);
        // DISK
        diskTotal += realtime['hookValues']['system.disk./.totalSpace'];
        diskUsable += realtime['hookValues']['system.disk./.usableSpace'];

        // RAM

        maxMemory += realtime['hookValues']['process.runtime.maxMemory'];
        totalMemory += realtime['hookValues']['process.runtime.totalMemory'];
        availableMemory += realtime['hookValues']['process.runtime.availableMemory'];

        // CONNECTIONS

        connections += realtime['hookValues']['server.connections.actives'];


        if (realtime['chronos']['distributed.node.latency']) {
          latency += realtime['chronos']['distributed.node.latency'].average;
        }
        if (realtime['chronos']['server.network.requests']) {
          requests += realtime['chronos']['server.network.requests'].entries;
        }

        var keys = Object.keys(realtime['chronos']).filter(function (k) {
          return k.match(/db.*Record/g) != null;
        })
        var ops = 0;
        keys.forEach(function (k) {
          ops += realtime['chronos'][k].entries;
        });
        operations += ops;
      })

      $scope.cpu = (cpu / keys.length).toFixed(2);
      $scope.disk = Math.floor((100 - (diskUsable * 100) / diskTotal));

      $scope.latency = (latency / keys.length);

      var used = totalMemory - availableMemory;

      $scope.ram = Math.floor(((used * 100) / maxMemory));

      $scope.activeConnections = connections;


      if (lastRequest != null) {

        $scope.requests = Math.abs(requests - lastRequest);
      }
      lastRequest = requests;

      if (lastOps != null) {
        $scope.operations = Math.abs(lastOps - operations);
      }
      lastOps = operations;
    }
  })
});


ee.controller("ProfilerController", ['$scope', 'Profiler', 'Cluster', 'Spinner', 'Notification', function ($scope, Profiler, Cluster, Spinner, Notification) {


  Cluster.node().then(function (data) {
    $scope.servers = data.members;
    $scope.server = $scope.servers[0];

    if ($scope.server.databases.length > 0) {
      $scope.db = $scope.server.databases[0];
      $scope.refresh();
    }
  });

  $scope.itemsByPage = 4;
  $scope.profiles = []

  $scope.refresh = function () {
    Spinner.start();
    var metricName = 'db.' + $scope.db + '.command.';
    Profiler.profilerData({server: $scope.server.name, db: $scope.db}).then(function (data) {
      var profiling = $scope.flatten(data.realtime.chronos, metricName);
      $scope.profiles = profiling;
      $scope.safeCopy = angular.copy(profiling);
      Spinner.stopSpinner();
    }).catch(function (error) {
      if (error.status == 405) {
        Notification.push({content: error.data, error: true, autoHide: true});
      } else {
        Notification.push({content: error.data, error: true, autoHide: true});
      }
      Spinner.stopSpinner();
    })
  }


  $scope.flatten = function (result, metricName) {
    var commands = new Array;
    Object.keys(result).forEach(function (e, i, a) {
      var obj = {};
      obj.name = e.substring(metricName.length, e.length);
      Object.keys(result[e]).forEach(function (ele, ide, arr) {
        obj[ele] = result[e][ele];
      });

      commands.push(obj);

    });
    return commands;
  }
  $scope.$watch('profiles', function (data) {

  })
}]);


ee.controller("AuditingController", ['$scope', 'Auditing', 'Cluster', 'Spinner', 'Notification', '$modal', 'ngTableParams', function ($scope, Auditing, Cluster, Spinner, Notification, $modal, ngTableParams) {


  $scope.active = 'log';

  $scope.query = {
    limit: 100
  }

  Cluster.node().then(function (data) {
    $scope.servers = data.members;
    $scope.server = $scope.servers[0];

    if ($scope.server.databases.length > 0) {
      $scope.db = $scope.server.databases[0];

      initConfig();
    }
  });

  $scope.template = 'views/database/auditing/log.html';

  var initConfig = function () {
    Auditing.getConfig({db: $scope.db}).then(function (data) {
      $scope.config = data;
      var cls = $scope.config.classes;
      $scope.classes = Object.keys(cls).filter(function (k) {
        return (k != "@type" && k != "@version")
      }).map(function (k) {

        var clazz = {
          name: k,
          polymorphic: cls[k].polymorphic
        }

        return clazz;

      })

      $scope.query.clazz = $scope.config.auditClassName;

      Spinner.start();
      Auditing.query({db: $scope.db}, $scope.query).then(function (data) {
        $scope.logs = data.result;

        $scope.tableParams = new ngTableParams({
          page: 1,            // show first page
          count: 10          // count per page

        }, {
          total: $scope.logs.length, // length of data
          getData: function ($defer, params) {
//            use build-in angular filter
            var emtpy = !params.orderBy() || params.orderBy().length == 0;
            var orderedData = (params.sorting() && !emtpy) ?
              $filter('orderBy')($scope.logs, params.orderBy()) :
              $scope.logs;
            $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
          }
        });
        Spinner.stopSpinner();
      }).catch(function (error) {
        Spinner.stopSpinner();
      })
    });
  }

  $scope.resetFilter = function () {
    $scope.query = {
      limit: 100,
      clazz: $scope.config.auditClassName
    }
  }
  $scope.save = function () {

    Auditing.saveConfig({db: $scope.db}, $scope.config).then(function () {
      Notification.push({content: "Auditing configuration saved.", autoHide: true});
    }).catch(function (error) {

    })
  }

  $scope.filter = function () {
    Spinner.start();
    Auditing.query(Database.getName(), $scope.query).then(function (data) {
      $scope.logs = data.result;
      $scope.tableParams.total($scope.logs.length);
      $scope.tableParams.reload();
      Spinner.stopSpinner();
    }).catch(function (error) {
      Spinner.stopSpinner();
    })
  }
  $scope.$watch("active", function (val) {
    switch (val) {
      case "config":
        $scope.template = 'views/database/auditing/config.html';
        break;
      case "log":
        $scope.template = 'views/database/auditing/log.html';
        break;
    }
  })
  $scope.delete = function (k) {
    delete $scope.config.classes[k];
  }
  $scope.addCommand = function () {
    if (!$scope.config.commands) {
      $scope.config.commands = new Array;
    }
    $scope.config.commands.push({
      regex: "",
      message: ""
    })
  }
  $scope.deleteCommand = function (index) {
    $scope.config.commands.splice(index, 1);
  }
  $scope.addClass = function () {
    var modalScope = $scope.$new(true);
    modalScope.classes = Database.listClasses();
    var modalPromise = $modal({template: 'views/database/auditing/newClass.html', scope: modalScope, show: false});

    modalScope.save = function () {
      if (modalPromise.$scope.selectedClass) {
        var cfg = {
          "polymorphic": true,
          "onCreateEnabled": false,
          "onCreateMessage": "",
          "onReadEnabled": false,
          "onReadMessage": "",
          "onUpdateEnabled": false,
          "onUpdateMessage": "",
          "onDeleteEnabled": false,
          "onDeleteMessage": ""
        }
        $scope.config.classes[modalPromise.$scope.selectedClass.name] = cfg;

      }
    }
    modalPromise.$promise.then(modalPromise.show);
  }
}]);


ee.controller('PluginsController', function ($scope, Plugins, Cluster, Notification) {

  $scope.editorOptions = {
    lineWrapping: true,
    lineNumbers: true,
    mode: 'javascript'
  };

  $scope.customTemplate = {
    'mail': 'views/server/plugins/mail.html'
  }
  $scope.dirty = false;
  $scope.selectPlugin = function (plugin) {
    $scope.selectedPlugin = plugin;
    $scope.selectedConfiguration = JSON.stringify(plugin.configuration);
  }
  Cluster.node().then(function (data) {
    $scope.servers = data.members;
    $scope.server = $scope.servers[0];

  });

  $scope.getTemplate = function () {
    if ($scope.selectedPlugin) {
      return $scope.customTemplate[$scope.selectedPlugin.name];
    }
  }

  $scope.isCustomPlugin = function () {

    if ($scope.selectedPlugin) {
      return $scope.customTemplate[$scope.selectedPlugin.name];
    }
    return false;
  }
  $scope.$watch('server', function (server) {
    if (server) {
      Plugins.all(server.name).then(function (data) {
        $scope.plugins = data.plugins;
        $scope.selectedPlugin = $scope.plugins[0];
        $scope.selectedConfiguration = angular.copy($scope.selectedPlugin.configuration);
        $scope.originalConfiguration = JSON.stringify($scope.selectedPlugin.configuration);
      })
    }
  })
  $scope.$watch('selectedConfiguration', function (newVal) {
    if (newVal) {
      if (JSON.stringify(newVal) != $scope.originalConfiguration) {
        $scope.dirty = true;
      } else {
        $scope.dirty = false;
      }
    }

  })

  $scope.saveConfiguration = function () {

    Plugins.saveConfig($scope.server.name, $scope.selectedPlugin.name, $scope.selectedConfiguration).then(function (data) {
      $scope.dirty = false;
      $scope.selectedPlugin.configuration = data;
      Notification.push({content: "Plugin configuration saved correctly.", autoHide: true});
    }).catch(function (error) {

      Notification.push({content: error.data, error: true, autoHide: true});
    });
  }
})

ee.controller('MailController', function ($scope) {


  $scope.$watch('selectedPlugin', function (data) {
    if (data) {
      $scope.profiles = $scope.selectedConfiguration.profiles;
      $scope.profile = $scope.profiles[0]

    }
  })

});
