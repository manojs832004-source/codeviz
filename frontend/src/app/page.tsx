'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { Loader2, Terminal, Keyboard, Zap, Sun, Moon, SplitSquareHorizontal, BookOpen, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false });

const SAMPLES: Record<string, string> = {
  python: `# Bubble Sort\narr = [64, 34, 25, 12, 22, 11, 90]\nn = len(arr)\nfor i in range(n - 1):\n    for j in range(0, n - i - 1):\n        if arr[j] > arr[j + 1]:\n            arr[j], arr[j + 1] = arr[j + 1], arr[j]\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        int[] arr = {64, 34, 25, 12, 22, 11, 90};\n        int n = arr.length;\n        for (int i = 0; i < n - 1; i++) {\n            for (int j = 0; j < n - i - 1; j++) {\n                if (arr[j] > arr[j + 1]) {\n                    int temp = arr[j];\n                    arr[j] = arr[j + 1];\n                    arr[j + 1] = temp;\n                }\n            }\n        }\n    }\n}\n`,
  c: `#include <stdio.h>\nint main() {\n    int arr[] = {29, 10, 14, 37, 13};\n    int n = 5;\n    for (int i = 0; i < n - 1; i++) {\n        int min_index = i;\n        for (int j = i + 1; j < n; j++) {\n            if (arr[j] < arr[min_index]) {\n                min_index = j;\n            }\n        }\n        int temp = arr[i];\n        arr[i] = arr[min_index];\n        arr[min_index] = temp;\n    }\n    printf("Sorted\\n");\n    return 0;\n}\n`
};

interface Preset {
  id: string;
  name: string;
  category: string;
  lang: Lang;
  code: string;
}

const PRESETS: Preset[] = [
  // --- Sorting ---
  {
    id: 'py-bubble', name: 'Bubble Sort', category: 'Sorting', lang: 'python',
    code: `# Bubble Sort\narr = [64, 34, 25, 12, 22, 11, 90]\nn = len(arr)\nfor i in range(n - 1):\n    for j in range(0, n - i - 1):\n        if arr[j] > arr[j + 1]:\n            arr[j], arr[j + 1] = arr[j + 1], arr[j]\n`
  },
  {
    id: 'py-selection', name: 'Selection Sort', category: 'Sorting', lang: 'python',
    code: `# Selection Sort\narr = [64, 25, 12, 22, 11]\nn = len(arr)\nfor i in range(n):\n    min_idx = i\n    for j in range(i + 1, n):\n        if arr[j] < arr[min_idx]:\n            min_idx = j\n    arr[i], arr[min_idx] = arr[min_idx], arr[i]\n`
  },
  {
    id: 'py-insertion', name: 'Insertion Sort', category: 'Sorting', lang: 'python',
    code: `# Insertion Sort\narr = [12, 11, 13, 5, 6]\nfor i in range(1, len(arr)):\n    key = arr[i]\n    j = i - 1\n    while j >= 0 and arr[j] > key:\n        arr[j + 1] = arr[j]\n        j -= 1\n    arr[j + 1] = key\n`
  },
  {
    id: 'c-bubble', name: 'Bubble Sort', category: 'Sorting', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int arr[] = {64, 34, 25, 12, 22};\n    int n = 5;\n    for (int i = 0; i < n - 1; i++) {\n        for (int j = 0; j < n - i - 1; j++) {\n            if (arr[j] > arr[j + 1]) {\n                int temp = arr[j];\n                arr[j] = arr[j + 1];\n                arr[j + 1] = temp;\n            }\n        }\n    }\n    return 0;\n}\n`
  },
  {
    id: 'c-selection', name: 'Selection Sort', category: 'Sorting', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int arr[] = {29, 10, 14, 37, 13};\n    int n = 5;\n    for (int i = 0; i < n - 1; i++) {\n        int min_index = i;\n        for (int j = i + 1; j < n; j++) {\n            if (arr[j] < arr[min_index])\n                min_index = j;\n        }\n        int temp = arr[i];\n        arr[i] = arr[min_index];\n        arr[min_index] = temp;\n    }\n    return 0;\n}\n`
  },
  {
    id: 'java-bubble', name: 'Bubble Sort', category: 'Sorting', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] arr = {64, 34, 25, 12, 22, 11, 90};\n        int n = arr.length;\n        for (int i = 0; i < n - 1; i++) {\n            for (int j = 0; j < n - i - 1; j++) {\n                if (arr[j] > arr[j + 1]) {\n                    int temp = arr[j];\n                    arr[j] = arr[j + 1];\n                    arr[j + 1] = temp;\n                }\n            }\n        }\n    }\n}\n`
  },
  // --- Searching ---
  {
    id: 'py-binary-search', name: 'Binary Search', category: 'Searching', lang: 'python',
    code: `# Binary Search\narr = [2, 3, 4, 10, 40]\ntarget = 10\nlow = 0\nhigh = len(arr) - 1\nresult = -1\nwhile low <= high:\n    mid = (low + high) // 2\n    if arr[mid] == target:\n        result = mid\n        break\n    elif arr[mid] < target:\n        low = mid + 1\n    else:\n        high = mid - 1\n`
  },
  {
    id: 'c-binary-search', name: 'Binary Search', category: 'Searching', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int arr[] = {2, 3, 4, 10, 40};\n    int n = 5;\n    int target = 10;\n    int low = 0, high = n - 1, mid, result = -1;\n    while (low <= high) {\n        mid = (low + high) / 2;\n        if (arr[mid] == target) { result = mid; break; }\n        else if (arr[mid] < target) low = mid + 1;\n        else high = mid - 1;\n    }\n    return 0;\n}\n`
  },
  {
    id: 'java-binary-search', name: 'Binary Search', category: 'Searching', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] arr = {2, 3, 4, 10, 40};\n        int target = 10;\n        int low = 0, high = arr.length - 1;\n        int result = -1;\n        while (low <= high) {\n            int mid = low + (high - low) / 2;\n            if (arr[mid] == target) {\n                result = mid;\n                break;\n            }\n            if (arr[mid] < target) {\n                low = mid + 1;\n            } else {\n                high = mid - 1;\n            }\n        }\n    }\n}\n`
  },
  // --- Recursion ---
  {
    id: 'py-fibonacci', name: 'Fibonacci (Recursion)', category: 'Recursion', lang: 'python',
    code: `# Fibonacci - Recursive\ndef fib(n):\n    if n <= 1:\n        return n\n    return fib(n - 1) + fib(n - 2)\n\nresult = fib(6)\n`
  },
  {
    id: 'py-factorial', name: 'Factorial (Recursion)', category: 'Recursion', lang: 'python',
    code: `# Factorial - Recursive\ndef factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)\n\nresult = factorial(5)\n`
  },
  {
    id: 'c-factorial', name: 'Factorial (Recursion)', category: 'Recursion', lang: 'c',
    code: `#include <stdio.h>\nint factorial(int n) {\n    if (n == 0) return 1;\n    return n * factorial(n - 1);\n}\nint main() {\n    int result = factorial(5);\n    printf("%d\\n", result);\n    return 0;\n}\n`
  },
  // --- Linked List ---
  {
    id: 'java-linked-list', name: 'Linked List Reverse', category: 'Linked List', lang: 'java',
    code: `class Node {\n    int val;\n    Node next;\n    Node(int d) { val = d; next = null; }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Node head = new Node(1);\n        head.next = new Node(2);\n        head.next.next = new Node(3);\n        head.next.next.next = new Node(4);\n        Node prev = null;\n        Node curr = head;\n        while (curr != null) {\n            Node nextTemp = curr.next;\n            curr.next = prev;\n            prev = curr;\n            curr = nextTemp;\n        }\n        head = prev;\n    }\n}\n`
  },
  // --- Trees ---
  {
    id: 'py-bst', name: 'Binary Search Tree', category: 'Trees', lang: 'python',
    code: `# Binary Search Tree Insertion\nclass Node:\n    def __init__(self, val):\n        self.val = val\n        self.left = None\n        self.right = None\n\ndef insert(root, val):\n    if root is None:\n        return Node(val)\n    if val < root.val:\n        root.left = insert(root.left, val)\n    else:\n        root.right = insert(root.right, val)\n    return root\n\nroot = None\nfor val in [50, 30, 70, 20, 40, 60, 80]:\n    root = insert(root, val)\n`
  },
  // --- Stack ---
  {
    id: 'py-stack', name: 'Stack Operations', category: 'Data Structures', lang: 'python',
    code: `# Stack using a list\nstack = []\n# Push elements\nfor val in [10, 20, 30, 40]:\n    stack.append(val)\n# Pop elements\nwhile stack:\n    top = stack.pop()\n`
  },
  // --- Two Pointers ---
  {
    id: 'py-two-sum', name: 'Two Sum (Two Pointers)', category: 'Algorithms', lang: 'python',
    code: `# Two Sum with sorted array\narr = [1, 2, 3, 4, 6]\ntarget = 6\nleft = 0\nright = len(arr) - 1\nresult = (-1, -1)\nwhile left < right:\n    s = arr[left] + arr[right]\n    if s == target:\n        result = (left, right)\n        break\n    elif s < target:\n        left += 1\n    else:\n        right -= 1\n`
  },

  // --- Sorting additions ---
  {
    id: 'java-selection', name: 'Selection Sort', category: 'Sorting', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] arr = {64, 25, 12, 22, 11};\n        int n = arr.length;\n        for (int i = 0; i < n; i++) {\n            int min_idx = i;\n            for (int j = i + 1; j < n; j++) {\n                if (arr[j] < arr[min_idx]) min_idx = j;\n            }\n            int temp = arr[min_idx];\n            arr[min_idx] = arr[i];\n            arr[i] = temp;\n        }\n    }\n}\n`
  },
  {
    id: 'java-insertion', name: 'Insertion Sort', category: 'Sorting', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] arr = {12, 11, 13, 5, 6};\n        for (int i = 1; i < arr.length; i++) {\n            int key = arr[i];\n            int j = i - 1;\n            while (j >= 0 && arr[j] > key) {\n                arr[j + 1] = arr[j];\n                j = j - 1;\n            }\n            arr[j + 1] = key;\n        }\n    }\n}\n`
  },
  {
    id: 'c-insertion', name: 'Insertion Sort', category: 'Sorting', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int arr[] = {12, 11, 13, 5, 6};\n    int n = 5;\n    for (int i = 1; i < n; i++) {\n        int key = arr[i];\n        int j = i - 1;\n        while (j >= 0 && arr[j] > key) {\n            arr[j + 1] = arr[j];\n            j = j - 1;\n        }\n        arr[j + 1] = key;\n    }\n    return 0;\n}\n`
  },
  // --- Searching additions ---
  {
    id: 'py-linear-search', name: 'Linear Search', category: 'Searching', lang: 'python',
    code: `# Linear Search\narr = [10, 20, 80, 30, 60, 50, 110, 100, 130, 170]\ntarget = 110\nresult = -1\nfor i in range(len(arr)):\n    if arr[i] == target:\n        result = i\n        break\n`
  },
  {
    id: 'java-linear-search', name: 'Linear Search', category: 'Searching', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] arr = {10, 20, 80, 30, 60, 50, 110, 100, 130, 170};\n        int target = 110;\n        int result = -1;\n        for (int i = 0; i < arr.length; i++) {\n            if (arr[i] == target) {\n                result = i;\n                break;\n            }\n        }\n    }\n}\n`
  },
  {
    id: 'c-linear-search', name: 'Linear Search', category: 'Searching', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int arr[] = {10, 20, 80, 30, 60, 50, 110, 100, 130, 170};\n    int n = 10;\n    int target = 110;\n    int result = -1;\n    for (int i = 0; i < n; i++) {\n        if (arr[i] == target) {\n            result = i;\n            break;\n        }\n    }\n    return 0;\n}\n`
  },
  {
    id: 'py-find-max', name: 'Find Maximum', category: 'Searching', lang: 'python',
    code: `# Find Maximum Element\narr = [10, 324, 45, 90, 9808]\nmax_val = arr[0]\nfor i in range(1, len(arr)):\n    if arr[i] > max_val:\n        max_val = arr[i]\n`
  },
  {
    id: 'java-find-max', name: 'Find Maximum', category: 'Searching', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] arr = {10, 324, 45, 90, 9808};\n        int max_val = arr[0];\n        for (int i = 1; i < arr.length; i++) {\n            if (arr[i] > max_val) {\n                max_val = arr[i];\n            }\n        }\n    }\n}\n`
  },
  {
    id: 'c-find-max', name: 'Find Maximum', category: 'Searching', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int arr[] = {10, 324, 45, 90, 9808};\n    int n = 5;\n    int max_val = arr[0];\n    for (int i = 1; i < n; i++) {\n        if (arr[i] > max_val) {\n            max_val = arr[i];\n        }\n    }\n    return 0;\n}\n`
  },
  // --- Recursion additions ---
  {
    id: 'java-fibonacci', name: 'Fibonacci (Recursion)', category: 'Recursion', lang: 'java',
    code: `public class Main {\n    static int fib(int n) {\n        if (n <= 1) return n;\n        return fib(n - 1) + fib(n - 2);\n    }\n    public static void main(String[] args) {\n        int result = fib(6);\n    }\n}\n`
  },
  {
    id: 'c-fibonacci', name: 'Fibonacci (Recursion)', category: 'Recursion', lang: 'c',
    code: `#include <stdio.h>\nint fib(int n) {\n    if (n <= 1) return n;\n    return fib(n - 1) + fib(n - 2);\n}\nint main() {\n    int result = fib(6);\n    return 0;\n}\n`
  },
  {
    id: 'java-factorial', name: 'Factorial (Recursion)', category: 'Recursion', lang: 'java',
    code: `public class Main {\n    static int factorial(int n) {\n        if (n == 0) return 1;\n        return n * factorial(n - 1);\n    }\n    public static void main(String[] args) {\n        int result = factorial(5);\n    }\n}\n`
  },
  {
    id: 'py-rec-sum', name: 'Recursive Sum', category: 'Recursion', lang: 'python',
    code: `# Recursive Sum of Array\ndef recursive_sum(arr, n):\n    if n <= 0:\n        return 0\n    return arr[n - 1] + recursive_sum(arr, n - 1)\n\narr = [1, 2, 3, 4, 5]\nresult = recursive_sum(arr, len(arr))\n`
  },
  {
    id: 'java-rec-sum', name: 'Recursive Sum', category: 'Recursion', lang: 'java',
    code: `public class Main {\n    static int recursiveSum(int[] arr, int n) {\n        if (n <= 0) return 0;\n        return arr[n - 1] + recursiveSum(arr, n - 1);\n    }\n    public static void main(String[] args) {\n        int[] arr = {1, 2, 3, 4, 5};\n        int result = recursiveSum(arr, arr.length);\n    }\n}\n`
  },
  {
    id: 'c-rec-sum', name: 'Recursive Sum', category: 'Recursion', lang: 'c',
    code: `#include <stdio.h>\nint recursive_sum(int arr[], int n) {\n    if (n <= 0) return 0;\n    return arr[n - 1] + recursive_sum(arr, n - 1);\n}\nint main() {\n    int arr[] = {1, 2, 3, 4, 5};\n    int result = recursive_sum(arr, 5);\n    return 0;\n}\n`
  },
  // --- Linked List additions ---
  {
    id: 'py-linked-list', name: 'Linked List Reverse', category: 'Linked List', lang: 'python',
    code: `class Node:\n    def __init__(self, val):\n        self.val = val\n        self.next = None\n\nn1 = Node(1)\nn1.next = Node(2)\nn1.next.next = Node(3)\nn1.next.next.next = Node(4)\nhead = n1\nprev = None\ncurr = head\nwhile curr is not None:\n    next_temp = curr.next\n    curr.next = prev\n    prev = curr\n    curr = next_temp\nhead = prev\n`
  },
  {
    id: 'c-linked-list', name: 'Linked List Reverse', category: 'Linked List', lang: 'c',
    code: `#include <stdio.h>\nstruct Node {\n    int val;\n    struct Node* next;\n};\nint main() {\n    struct Node n4 = {4, NULL};\n    struct Node n3 = {3, &n4};\n    struct Node n2 = {2, &n3};\n    struct Node n1 = {1, &n2};\n    struct Node* head = &n1;\n    struct Node* prev = NULL;\n    struct Node* curr = head;\n    while (curr != NULL) {\n        struct Node* nextTemp = curr->next;\n        curr->next = prev;\n        prev = curr;\n        curr = nextTemp;\n    }\n    head = prev;\n    return 0;\n}\n`
  },
  {
    id: 'py-ll-middle', name: 'Linked List Middle', category: 'Linked List', lang: 'python',
    code: `class Node:\n    def __init__(self, val):\n        self.val = val\n        self.next = None\n\nn1 = Node(1)\nn1.next = Node(2)\nn1.next.next = Node(3)\nn1.next.next.next = Node(4)\nn1.next.next.next.next = Node(5)\nhead = n1\nslow = head\nfast = head\nwhile fast is not None and fast.next is not None:\n    slow = slow.next\n    fast = fast.next.next\nmiddle = slow.val\n`
  },
  {
    id: 'java-ll-middle', name: 'Linked List Middle', category: 'Linked List', lang: 'java',
    code: `class Node {\n    int val;\n    Node next;\n    Node(int d) { val = d; next = null; }\n}\npublic class Main {\n    public static void main(String[] args) {\n        Node head = new Node(1);\n        head.next = new Node(2);\n        head.next.next = new Node(3);\n        head.next.next.next = new Node(4);\n        head.next.next.next.next = new Node(5);\n        Node slow = head;\n        Node fast = head;\n        while (fast != null && fast.next != null) {\n            slow = slow.next;\n            fast = fast.next.next;\n        }\n        int middle = slow.val;\n    }\n}\n`
  },
  {
    id: 'c-ll-middle', name: 'Linked List Middle', category: 'Linked List', lang: 'c',
    code: `#include <stdio.h>\nstruct Node {\n    int val;\n    struct Node* next;\n};\nint main() {\n    struct Node n5 = {5, NULL};\n    struct Node n4 = {4, &n5};\n    struct Node n3 = {3, &n4};\n    struct Node n2 = {2, &n3};\n    struct Node n1 = {1, &n2};\n    struct Node* head = &n1;\n    struct Node* slow = head;\n    struct Node* fast = head;\n    while (fast != NULL && fast->next != NULL) {\n        slow = slow->next;\n        fast = fast->next->next;\n    }\n    int middle = slow->val;\n    return 0;\n}\n`
  },
  {
    id: 'py-ll-cycle', name: 'Detect Cycle', category: 'Linked List', lang: 'python',
    code: `class Node:\n    def __init__(self, val):\n        self.val = val\n        self.next = None\n\nn1 = Node(1)\nn2 = Node(2)\nn3 = Node(3)\nn4 = Node(4)\nn1.next = n2\nn2.next = n3\nn3.next = n4\nn4.next = n2 # Cycle\nhead = n1\nslow = head\nfast = head\nhas_cycle = False\nwhile fast is not None and fast.next is not None:\n    slow = slow.next\n    fast = fast.next.next\n    if slow == fast:\n        has_cycle = True\n        break\n`
  },
  {
    id: 'java-ll-cycle', name: 'Detect Cycle', category: 'Linked List', lang: 'java',
    code: `class Node {\n    int val;\n    Node next;\n    Node(int d) { val = d; next = null; }\n}\npublic class Main {\n    public static void main(String[] args) {\n        Node n1 = new Node(1);\n        Node n2 = new Node(2);\n        Node n3 = new Node(3);\n        Node n4 = new Node(4);\n        n1.next = n2;\n        n2.next = n3;\n        n3.next = n4;\n        n4.next = n2; // Cycle\n        Node head = n1;\n        Node slow = head;\n        Node fast = head;\n        boolean hasCycle = false;\n        while (fast != null && fast.next != null) {\n            slow = slow.next;\n            fast = fast.next.next;\n            if (slow == fast) {\n                hasCycle = true;\n                break;\n            }\n        }\n    }\n}\n`
  },
  {
    id: 'c-ll-cycle', name: 'Detect Cycle', category: 'Linked List', lang: 'c',
    code: `#include <stdio.h>\n#include <stdbool.h>\nstruct Node {\n    int val;\n    struct Node* next;\n};\nint main() {\n    struct Node n4 = {4, NULL};\n    struct Node n3 = {3, &n4};\n    struct Node n2 = {2, &n3};\n    struct Node n1 = {1, &n2};\n    n4.next = &n2; // Cycle\n    struct Node* head = &n1;\n    struct Node* slow = head;\n    struct Node* fast = head;\n    bool has_cycle = false;\n    while (fast != NULL && fast->next != NULL) {\n        slow = slow->next;\n        fast = fast->next->next;\n        if (slow == fast) {\n            has_cycle = true;\n            break;\n        }\n    }\n    return 0;\n}\n`
  },
  // --- Trees additions ---
  {
    id: 'java-bst', name: 'Binary Search Tree', category: 'Trees', lang: 'java',
    code: `class Node {\n    int val;\n    Node left, right;\n    Node(int v) { val = v; left = right = null; }\n}\npublic class Main {\n    static Node insert(Node root, int val) {\n        if (root == null) return new Node(val);\n        if (val < root.val) root.left = insert(root.left, val);\n        else root.right = insert(root.right, val);\n        return root;\n    }\n    public static void main(String[] args) {\n        Node root = null;\n        int[] vals = {50, 30, 70, 20, 40, 60, 80};\n        for (int val : vals) {\n            root = insert(root, val);\n        }\n    }\n}\n`
  },
  {
    id: 'c-bst', name: 'Binary Search Tree', category: 'Trees', lang: 'c',
    code: `#include <stdio.h>\nstruct Node {\n    int val;\n    struct Node* left;\n    struct Node* right;\n};\nstruct Node nodes[10];\nint node_count = 0;\nstruct Node* insert(struct Node* root, int val) {\n    if (root == NULL) {\n        nodes[node_count].val = val;\n        nodes[node_count].left = NULL;\n        nodes[node_count].right = NULL;\n        return &nodes[node_count++];\n    }\n    if (val < root->val) root->left = insert(root->left, val);\n    else root->right = insert(root->right, val);\n    return root;\n}\nint main() {\n    struct Node* root = NULL;\n    int vals[] = {50, 30, 70, 20, 40, 60, 80};\n    for (int i = 0; i < 7; i++) {\n        root = insert(root, vals[i]);\n    }\n    return 0;\n}\n`
  },
  {
    id: 'py-tree-inorder', name: 'Tree Inorder Traversal', category: 'Trees', lang: 'python',
    code: `class Node:\n    def __init__(self, val):\n        self.val = val\n        self.left = None\n        self.right = None\n\ndef inorder(root):\n    if root is not None:\n        inorder(root.left)\n        print(root.val)\n        inorder(root.right)\n\nroot = Node(1)\nroot.right = Node(2)\nroot.right.left = Node(3)\ninorder(root)\n`
  },
  {
    id: 'java-tree-inorder', name: 'Tree Inorder Traversal', category: 'Trees', lang: 'java',
    code: `class Node {\n    int val;\n    Node left, right;\n    Node(int v) { val = v; left = right = null; }\n}\npublic class Main {\n    static void inorder(Node root) {\n        if (root != null) {\n            inorder(root.left);\n            System.out.println(root.val);\n            inorder(root.right);\n        }\n    }\n    public static void main(String[] args) {\n        Node root = new Node(1);\n        root.right = new Node(2);\n        root.right.left = new Node(3);\n        inorder(root);\n    }\n}\n`
  },
  {
    id: 'c-tree-inorder', name: 'Tree Inorder Traversal', category: 'Trees', lang: 'c',
    code: `#include <stdio.h>\nstruct Node {\n    int val;\n    struct Node* left;\n    struct Node* right;\n};\nvoid inorder(struct Node* root) {\n    if (root != NULL) {\n        inorder(root->left);\n        printf("%d\\n", root->val);\n        inorder(root->right);\n    }\n}\nint main() {\n    struct Node n3 = {3, NULL, NULL};\n    struct Node n2 = {2, &n3, NULL};\n    struct Node n1 = {1, NULL, &n2};\n    inorder(&n1);\n    return 0;\n}\n`
  },
  {
    id: 'py-tree-depth', name: 'Tree Max Depth', category: 'Trees', lang: 'python',
    code: `class Node:\n    def __init__(self, val):\n        self.val = val\n        self.left = None\n        self.right = None\n\ndef max_depth(root):\n    if root is None:\n        return 0\n    left_depth = max_depth(root.left)\n    right_depth = max_depth(root.right)\n    return max(left_depth, right_depth) + 1\n\nroot = Node(3)\nroot.left = Node(9)\nroot.right = Node(20)\nroot.right.left = Node(15)\nroot.right.right = Node(7)\ndepth = max_depth(root)\n`
  },
  {
    id: 'java-tree-depth', name: 'Tree Max Depth', category: 'Trees', lang: 'java',
    code: `class Node {\n    int val;\n    Node left, right;\n    Node(int v) { val = v; left = right = null; }\n}\npublic class Main {\n    static int maxDepth(Node root) {\n        if (root == null) return 0;\n        int leftDepth = maxDepth(root.left);\n        int rightDepth = maxDepth(root.right);\n        return Math.max(leftDepth, rightDepth) + 1;\n    }\n    public static void main(String[] args) {\n        Node root = new Node(3);\n        root.left = new Node(9);\n        root.right = new Node(20);\n        root.right.left = new Node(15);\n        root.right.right = new Node(7);\n        int depth = maxDepth(root);\n    }\n}\n`
  },
  {
    id: 'c-tree-depth', name: 'Tree Max Depth', category: 'Trees', lang: 'c',
    code: `#include <stdio.h>\nstruct Node {\n    int val;\n    struct Node* left;\n    struct Node* right;\n};\nint max_depth(struct Node* root) {\n    if (root == NULL) return 0;\n    int left_depth = max_depth(root->left);\n    int right_depth = max_depth(root->right);\n    return (left_depth > right_depth ? left_depth : right_depth) + 1;\n}\nint main() {\n    struct Node n15 = {15, NULL, NULL};\n    struct Node n7 = {7, NULL, NULL};\n    struct Node n20 = {20, &n15, &n7};\n    struct Node n9 = {9, NULL, NULL};\n    struct Node n3 = {3, &n9, &n20};\n    int depth = max_depth(&n3);\n    return 0;\n}\n`
  },
  // --- Data Structures additions ---
  {
    id: 'java-stack', name: 'Stack Operations', category: 'Data Structures', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] stack = new int[10];\n        int top = -1;\n        int[] vals = {10, 20, 30, 40};\n        for (int val : vals) {\n            stack[++top] = val;\n        }\n        while (top >= 0) {\n            int popped = stack[top--];\n        }\n    }\n}\n`
  },
  {
    id: 'c-stack', name: 'Stack Operations', category: 'Data Structures', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int stack[10];\n    int top = -1;\n    int vals[] = {10, 20, 30, 40};\n    for (int i = 0; i < 4; i++) {\n        stack[++top] = vals[i];\n    }\n    while (top >= 0) {\n        int popped = stack[top--];\n    }\n    return 0;\n}\n`
  },
  {
    id: 'py-queue', name: 'Queue Operations', category: 'Data Structures', lang: 'python',
    code: `# Queue using a list\nqueue = []\n# Enqueue elements\nfor val in [10, 20, 30, 40]:\n    queue.append(val)\n# Dequeue elements\nwhile len(queue) > 0:\n    front = queue.pop(0)\n`
  },
  {
    id: 'java-queue', name: 'Queue Operations', category: 'Data Structures', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] queue = new int[10];\n        int front = 0, rear = 0;\n        int[] vals = {10, 20, 30, 40};\n        for (int val : vals) {\n            queue[rear++] = val;\n        }\n        while (front < rear) {\n            int dequeued = queue[front++];\n        }\n    }\n}\n`
  },
  {
    id: 'c-queue', name: 'Queue Operations', category: 'Data Structures', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int queue[10];\n    int front = 0, rear = 0;\n    int vals[] = {10, 20, 30, 40};\n    for (int i = 0; i < 4; i++) {\n        queue[rear++] = vals[i];\n    }\n    while (front < rear) {\n        int dequeued = queue[front++];\n    }\n    return 0;\n}\n`
  },
  {
    id: 'py-reverse-arr', name: 'Array Reversal', category: 'Data Structures', lang: 'python',
    code: `# Array Reversal\narr = [1, 2, 3, 4, 5]\nleft = 0\nright = len(arr) - 1\nwhile left < right:\n    arr[left], arr[right] = arr[right], arr[left]\n    left += 1\n    right -= 1\n`
  },
  {
    id: 'java-reverse-arr', name: 'Array Reversal', category: 'Data Structures', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] arr = {1, 2, 3, 4, 5};\n        int left = 0, right = arr.length - 1;\n        while (left < right) {\n            int temp = arr[left];\n            arr[left] = arr[right];\n            arr[right] = temp;\n            left++;\n            right--;\n        }\n    }\n}\n`
  },
  {
    id: 'c-reverse-arr', name: 'Array Reversal', category: 'Data Structures', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int arr[] = {1, 2, 3, 4, 5};\n    int n = 5;\n    int left = 0, right = n - 1;\n    while (left < right) {\n        int temp = arr[left];\n        arr[left] = arr[right];\n        arr[right] = temp;\n        left++;\n        right--;\n    }\n    return 0;\n}\n`
  },
  // --- Algorithms additions ---
  {
    id: 'java-two-sum', name: 'Two Sum (Two Pointers)', category: 'Algorithms', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] arr = {1, 2, 3, 4, 6};\n        int target = 6;\n        int left = 0, right = arr.length - 1;\n        int[] result = {-1, -1};\n        while (left < right) {\n            int sum = arr[left] + arr[right];\n            if (sum == target) {\n                result[0] = left; result[1] = right;\n                break;\n            } else if (sum < target) {\n                left++;\n            } else {\n                right--;\n            }\n        }\n    }\n}\n`
  },
  {
    id: 'c-two-sum', name: 'Two Sum (Two Pointers)', category: 'Algorithms', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int arr[] = {1, 2, 3, 4, 6};\n    int n = 5;\n    int target = 6;\n    int left = 0, right = n - 1;\n    int res_left = -1, res_right = -1;\n    while (left < right) {\n        int sum = arr[left] + arr[right];\n        if (sum == target) {\n            res_left = left; res_right = right;\n            break;\n        } else if (sum < target) {\n            left++;\n        } else {\n            right--;\n        }\n    }\n    return 0;\n}\n`
  },
  {
    id: 'py-kadane', name: 'Kadane\'s Algorithm', category: 'Algorithms', lang: 'python',
    code: `# Kadane's Algorithm (Maximum Subarray Sum)\narr = [-2, 1, -3, 4, -1, 2, 1, -5, 4]\nmax_so_far = arr[0]\ncurrent_max = arr[0]\nfor i in range(1, len(arr)):\n    current_max = max(arr[i], current_max + arr[i])\n    max_so_far = max(max_so_far, current_max)\n`
  },
  {
    id: 'java-kadane', name: 'Kadane\'s Algorithm', category: 'Algorithms', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        int[] arr = {-2, 1, -3, 4, -1, 2, 1, -5, 4};\n        int maxSoFar = arr[0];\n        int currentMax = arr[0];\n        for (int i = 1; i < arr.length; i++) {\n            currentMax = Math.max(arr[i], currentMax + arr[i]);\n            maxSoFar = Math.max(maxSoFar, currentMax);\n        }\n    }\n}\n`
  },
  {
    id: 'c-kadane', name: 'Kadane\'s Algorithm', category: 'Algorithms', lang: 'c',
    code: `#include <stdio.h>\nint main() {\n    int arr[] = {-2, 1, -3, 4, -1, 2, 1, -5, 4};\n    int n = 9;\n    int maxSoFar = arr[0];\n    int currentMax = arr[0];\n    for (int i = 1; i < n; i++) {\n        currentMax = arr[i] > currentMax + arr[i] ? arr[i] : currentMax + arr[i];\n        maxSoFar = maxSoFar > currentMax ? maxSoFar : currentMax;\n    }\n    return 0;\n}\n`
  },
  {
    id: 'py-palindrome', name: 'Palindrome Check', category: 'Algorithms', lang: 'python',
    code: `# Palindrome Check\ns = "racecar"\nis_palindrome = True\nleft = 0\nright = len(s) - 1\nwhile left < right:\n    if s[left] != s[right]:\n        is_palindrome = False\n        break\n    left += 1\n    right -= 1\n`
  },
  {
    id: 'java-palindrome', name: 'Palindrome Check', category: 'Algorithms', lang: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        char[] s = "racecar".toCharArray();\n        boolean isPalindrome = true;\n        int left = 0, right = s.length - 1;\n        while (left < right) {\n            if (s[left] != s[right]) {\n                isPalindrome = false;\n                break;\n            }\n            left++;\n            right--;\n        }\n    }\n}\n`
  },
  {
    id: 'c-palindrome', name: 'Palindrome Check', category: 'Algorithms', lang: 'c',
    code: `#include <stdio.h>\n#include <string.h>\n#include <stdbool.h>\nint main() {\n    char s[] = "racecar";\n    int n = strlen(s);\n    bool is_palindrome = true;\n    int left = 0, right = n - 1;\n    while (left < right) {\n        if (s[left] != s[right]) {\n            is_palindrome = false;\n            break;\n        }\n        left++;\n        right--;\n    }\n    return 0;\n}\n`
  }
];

const CATEGORIES = ['All', ...Array.from(new Set(PRESETS.map(p => p.category)))];

type Lang = 'python' | 'java' | 'c';
type Status = 'idle' | 'running' | 'error';

export default function Home() {
  const router = useRouter();
  const [isRaceMode, setIsRaceMode] = useState(false);
  const [language, setLanguage] = useState<Lang>('python');
  const [code, setCode] = useState(SAMPLES.python);
  const [language2, setLanguage2] = useState<Lang>('python');
  const [code2, setCode2] = useState(SAMPLES.python);
  const [stdin, setStdin] = useState('');
  const [consoleOutput, setConsoleOutput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const presetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close preset dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePresetSelect = (preset: Preset) => {
    setLanguage(preset.lang);
    setCode(preset.code);
    setConsoleOutput('');
    setStatus('idle');
    setShowPresets(false);
  };

  const filteredPresets = activeCategory === 'All'
    ? PRESETS
    : PRESETS.filter(p => p.category === activeCategory);

  const handleLangChange = (lang: Lang) => {
    setLanguage(lang);
    setCode(SAMPLES[lang]);
    setConsoleOutput('');
    setStatus('idle');
  };

  const handleLang2Change = (lang: Lang) => {
    setLanguage2(lang);
    setCode2(SAMPLES[lang]);
    setConsoleOutput('');
    setStatus('idle');
  };

  const executeTrace = (lang: string, c: string, input: string, name: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      setConsoleOutput(prev => prev + `[${name}] Connecting to server...\n`);
      const ws = new WebSocket('ws://localhost:8080');
      ws.onopen = () => {
        setConsoleOutput(prev => prev + `[${name}] Connected. Executing code...\n`);
        ws.send(JSON.stringify({ type: 'EXECUTE', language: lang, code: c, stdin: input }));
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'STATUS') {
          setConsoleOutput(prev => prev + `[${name}] Status: ${msg.status}\n`);
        } else if (msg.type === 'RESULT') {
          ws.close();
          if (msg.success && msg.frames?.length) {
             setConsoleOutput(prev => prev + `[${name}] Complete. Captured ${msg.frames.length} frames.\n`);
             resolve({ frames: msg.frames, code: c, language: lang });
          } else {
             reject(new Error(`[${name}] ` + (msg.output || 'Unknown error')));
          }
        } else if (msg.type === 'ERROR') {
          ws.close();
          reject(new Error(`[${name}] ` + msg.message));
        }
      };
      ws.onerror = () => {
        reject(new Error(`[${name}] WebSocket connection failed`));
      };
    });
  };

  const handleVisualize = async () => {
    setStatus('running');
    setConsoleOutput('');
    try {
      if (isRaceMode) {
        const [trace1, trace2] = await Promise.all([
          executeTrace(language, code, stdin, 'Alg 1'),
          executeTrace(language2, code2, stdin, 'Alg 2')
        ]);
        sessionStorage.setItem('algoViz_trace_1', JSON.stringify(trace1));
        sessionStorage.setItem('algoViz_trace_2', JSON.stringify(trace2));
        router.push('/race');
      } else {
        const trace = await executeTrace(language, code, stdin, 'Main');
        sessionStorage.setItem('algoViz_trace', JSON.stringify(trace));
        sessionStorage.removeItem('algoViz_explanations');
        router.push('/visualize');
      }
    } catch (e: any) {
      setConsoleOutput(prev => prev + 'Error: ' + e.message + '\n');
      setStatus('error');
    }
  };

  const isFetching = status === 'running';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-zinc-300 transition-colors duration-300 relative">
      {/* Mesh Gradient Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden hidden dark:block">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[60%] bg-purple-600/15 rounded-full blur-[120px] mix-blend-screen" />
         <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-cyan-600/10 rounded-full blur-[100px] mix-blend-screen" />
      </div>

      <header className="relative z-50 h-16 flex items-center justify-between px-6 bg-white/70 dark:bg-[#0B0F19]/70 border-b border-slate-200 dark:border-white/5 shrink-0 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Zap className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h1 className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 dark:from-indigo-400 dark:via-purple-400 dark:to-cyan-400 bg-clip-text text-transparent">AlgoViz</h1>
          </div>
          <div className="h-5 w-px bg-slate-300 dark:bg-zinc-700" />
          <div className="flex gap-1.5 bg-slate-100 dark:bg-zinc-900/50 p-1 rounded-lg">
            {(['python','java','c'] as Lang[]).map(lang => (
              <button key={lang} onClick={() => handleLangChange(lang)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                  language === lang ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800'
                }`}>
                {lang === 'c' ? 'C' : lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Presets Button */}
          <div className="relative" ref={presetsRef}>
            <button
              onClick={() => setShowPresets(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                showPresets
                  ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-500/30'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Presets
              <ChevronDown className={`w-3 h-3 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
            </button>

            {showPresets && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                {/* Category Tabs */}
                <div className="flex gap-1 p-2 border-b border-slate-100 dark:border-zinc-800 flex-wrap">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                        activeCategory === cat
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {/* Preset List */}
                <div className="max-h-72 overflow-y-auto p-2 space-y-1" style={{ scrollbarWidth: 'thin' }}>
                  {filteredPresets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors group flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{preset.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{preset.category}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        preset.lang === 'python' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                        preset.lang === 'java' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' :
                        'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                      }`}>{preset.lang.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="w-px h-6 bg-slate-300 dark:bg-zinc-700" />
          <button 
            onClick={() => setIsRaceMode(!isRaceMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition ${isRaceMode ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
          >
            <SplitSquareHorizontal className="w-4 h-4" />
            Race Mode
          </button>
          <div className="w-px h-6 bg-slate-300 dark:bg-zinc-700" />
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition flex items-center justify-center">
            {mounted && (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)}
          </button>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0 flex">
            <div className={`flex-1 min-w-0 flex flex-col ${isRaceMode ? 'border-r border-slate-200 dark:border-white/5' : ''}`}>
              {isRaceMode && (
                <div className="bg-slate-100 dark:bg-zinc-900 px-4 py-2 text-xs font-bold text-slate-500 flex justify-between items-center border-b border-slate-200 dark:border-zinc-800 shrink-0">
                  <span>Algorithm 1</span>
                  <span>{language}</span>
                </div>
              )}
              <CodeEditor code={code} language={language === 'c' ? 'c' : language} onChange={(v) => setCode(v || '')} />
            </div>
            {isRaceMode && (
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="bg-slate-100 dark:bg-zinc-900 px-4 py-2 text-xs font-bold text-slate-500 flex justify-between items-center border-b border-slate-200 dark:border-zinc-800 shrink-0">
                  <span>Algorithm 2</span>
                  <div className="flex gap-1 bg-slate-200 dark:bg-zinc-800 p-0.5 rounded">
                    {(['python','java','c'] as Lang[]).map(lang => (
                      <button key={lang} onClick={() => handleLang2Change(lang)} className={`px-2 py-0.5 rounded text-[10px] ${language2 === lang ? 'bg-indigo-500 text-white' : ''}`}>
                        {lang.charAt(0).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <CodeEditor code={code2} language={language2 === 'c' ? 'c' : language2} onChange={(v) => setCode2(v || '')} />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-white/5 bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-xl w-full shrink-0">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {isRaceMode ? 'Compare two algorithms side-by-side.' : 'Write your code, then click Visualize to step through execution.'}
            </p>
            <button onClick={handleVisualize} disabled={isFetching}
              className="flex items-center gap-2 px-8 py-2.5 rounded-full bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/25">
              {isFetching ? (<><Loader2 className="w-5 h-5 animate-spin" /><span>Running...</span></>) : (<span>▶ {isRaceMode ? 'Visualize Race' : 'Visualize'}</span>)}
            </button>
          </div>
        </div>

        <div className="relative z-10 w-[400px] shrink-0 flex flex-col border-l border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-black/20 backdrop-blur-md">
          <div className="flex flex-col h-1/2 border-b border-slate-200 dark:border-white/5">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/50 dark:border-white/5 shrink-0 bg-white/50 dark:bg-transparent">
              <Keyboard className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Custom Input</span>
            </div>
            <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Enter standard input here..."
              className="flex-1 resize-none bg-transparent text-sm text-slate-700 dark:text-zinc-300 p-4 font-mono placeholder:text-slate-400 dark:placeholder:text-zinc-700 focus:outline-none" spellCheck={false} />
          </div>
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/50 dark:border-white/5 shrink-0 bg-white/50 dark:bg-transparent">
              <Terminal className="w-4 h-4 text-emerald-500 dark:emerald-400" />
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Console Output</span>
            </div>
            <pre className="flex-1 overflow-auto text-xs text-slate-600 dark:text-zinc-400 p-4 font-mono leading-relaxed whitespace-pre-wrap">
              {consoleOutput || 'Output will appear here...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
