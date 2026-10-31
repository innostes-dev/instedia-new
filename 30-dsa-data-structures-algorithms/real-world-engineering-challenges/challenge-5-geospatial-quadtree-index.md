# Challenge 5: Geospatial QuadTree Index

## 1. The Real-World Engineering Problem
You are building the driver-matching engine for a ride-sharing app (like Uber). You have a map with 100,000 active drivers. A rider requests a pickup at specific GPS coordinates `(lat, lng)`.
If you calculate the Haversine distance (spherical distance) between the rider and *every single driver* in the database, the server will crash (`O(N)`).
You need to implement a **QuadTree** Spatial Index to instantly filter down the search space to only drivers within a specific geographic bounding box, reducing the time complexity to `O(log N)`.

## 2. Architecture Diagram (QuadTree)
```text
Root Bounding Box: Entire City (Max 4 drivers per quadrant before splitting)

              [ ROOT ]
          /   |    |   \
        NW    NE   SW   SE
       / \
      ...

When searching a bounding box (e.g., Rider's radius):
1. Does the search box intersect with the ROOT box? Yes.
2. Check NW, NE, SW, SE.
3. If search box does NOT intersect NE, completely ignore it! (Pruning)
4. If it intersects SW, recursively search SW's children.
```

## 3. Starter Template
```javascript
// starter-template.js

class Point {
  constructor(id, lat, lng) {
    this.id = id;
    this.lat = lat;
    this.lng = lng;
  }
}

class BoundingBox {
  constructor(minLat, maxLat, minLng, maxLng) {
    this.minLat = minLat; this.maxLat = maxLat;
    this.minLng = minLng; this.maxLng = maxLng;
  }

  contains(point) {
    // TODO: Return true if point is inside box
  }

  intersects(otherBox) {
    // TODO: Return true if boxes overlap
  }
}

class QuadTree {
  constructor(boundary, capacity) {
    this.boundary = boundary; // BoundingBox
    this.capacity = capacity; // Max points before subdividing
    this.points = [];
    this.divided = false;
  }

  insert(point) {
    // TODO: Insert point. If at capacity, subdivide into 4 children and distribute
  }

  query(searchBox, found = []) {
    // TODO: If no intersection, return. Else, collect points and query children.
    return found;
  }
}
```

## 4. Production Walkthrough (Full Solution)

<details>
<summary>✅ View Full Production Solution & Tests</summary>

### The QuadTree Solution
A QuadTree is a 2D equivalent of a Binary Search Tree. When a zone gets too crowded, it splits into 4 smaller zones (NW, NE, SW, SE). When querying, we only traverse branches whose bounding boxes overlap with our search radius box, ignoring 75% of the data at every level!

```javascript
class Point {
  constructor(id, lat, lng) {
    this.id = id; this.lat = lat; this.lng = lng;
  }
}

class BoundingBox {
  constructor(minLat, maxLat, minLng, maxLng) {
    this.minLat = minLat; this.maxLat = maxLat;
    this.minLng = minLng; this.maxLng = maxLng;
  }

  contains(point) {
    return point.lat >= this.minLat && point.lat <= this.maxLat &&
           point.lng >= this.minLng && point.lng <= this.maxLng;
  }

  intersects(otherBox) {
    return !(otherBox.minLng > this.maxLng ||
             otherBox.maxLng < this.minLng ||
             otherBox.minLat > this.maxLat ||
             otherBox.maxLat < this.minLat);
  }
}

class QuadTree {
  constructor(boundary, capacity) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.points = [];
    this.divided = false;
  }

  subdivide() {
    const latMid = (this.boundary.minLat + this.boundary.maxLat) / 2;
    const lngMid = (this.boundary.minLng + this.boundary.maxLng) / 2;

    const nwBox = new BoundingBox(latMid, this.boundary.maxLat, this.boundary.minLng, lngMid);
    const neBox = new BoundingBox(latMid, this.boundary.maxLat, lngMid, this.boundary.maxLng);
    const swBox = new BoundingBox(this.boundary.minLat, latMid, this.boundary.minLng, lngMid);
    const seBox = new BoundingBox(this.boundary.minLat, latMid, lngMid, this.boundary.maxLng);

    this.nw = new QuadTree(nwBox, this.capacity);
    this.ne = new QuadTree(neBox, this.capacity);
    this.sw = new QuadTree(swBox, this.capacity);
    this.se = new QuadTree(seBox, this.capacity);
    this.divided = true;
  }

  insert(point) {
    if (!this.boundary.contains(point)) return false;

    if (this.points.length < this.capacity) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) this.subdivide();

    return this.nw.insert(point) || this.ne.insert(point) ||
           this.sw.insert(point) || this.se.insert(point);
  }

  query(searchBox, found = []) {
    // The Pruning Magic: If they don't intersect, abort this entire branch!
    if (!this.boundary.intersects(searchBox)) {
      return found;
    }

    for (let p of this.points) {
      if (searchBox.contains(p)) found.push(p);
    }

    if (this.divided) {
      this.nw.query(searchBox, found);
      this.ne.query(searchBox, found);
      this.sw.query(searchBox, found);
      this.se.query(searchBox, found);
    }

    return found;
  }
}
```

### Test Suite (Jest)
```javascript
describe('QuadTree Spatial Index', () => {
  it('should only return points within the search bounding box', () => {
    // City bounds: 0 to 100
    const city = new BoundingBox(0, 100, 0, 100);
    const qt = new QuadTree(city, 2); // Small capacity to force splits

    qt.insert(new Point("d1", 10, 10)); // SW
    qt.insert(new Point("d2", 90, 90)); // NE
    qt.insert(new Point("d3", 95, 95)); // NE
    qt.insert(new Point("d4", 98, 98)); // NE (forces split)
    qt.insert(new Point("d5", 15, 15)); // SW

    // Search NE corner (75 to 100)
    const searchArea = new BoundingBox(75, 100, 75, 100);
    const results = qt.query(searchArea);

    expect(results).toHaveLength(3);
    const ids = results.map(r => r.id);
    expect(ids).toContain("d2");
    expect(ids).toContain("d3");
    expect(ids).toContain("d4");
    expect(ids).not.toContain("d1"); // SW driver correctly excluded
  });
});
```
</details>
